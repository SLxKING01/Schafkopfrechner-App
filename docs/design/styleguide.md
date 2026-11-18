# Styleguide

Stand: 18.11.2026. Quelle der Wahrheit ist der Code in `src/theme/`. Dieses Dokument beschreibt ihn; weicht es ab, gilt der Code.

## Grundsätze

- **Ein Design:** dunkles Grün mit Gold („Kartentisch“). Ein helles Theme gibt es nicht mehr.
- **Nur Tokens:** Farben, Schriftgrößen, Abstände, Rundungen, Schatten und Icon-Größen kommen aus `src/theme/`. Keine Zahlen oder Hex-Werte direkt in Screens.
- **Ein Einstieg:** `import { authColors, authSpacing, … } from '../theme'` (bzw. `src/theme/index.ts`).
- **Basis-Komponenten zuerst:** `AppText`, `AppButton`, `AppCard`, `AppSection`, `AppIcon`, `PageHeader`, `InteractionSheet` (in `src/components/ui/`) sowie `GoldButton` und `AuthInput` (in `src/components/auth/`).

### Automatisch geprüft

`src/__tests__/designTokens.test.ts` lässt die Tests fehlschlagen, wenn

1. andere Icons als Lucide verwendet werden (`@expo/vector-icons`, `react-native-vector-icons`),
2. Lucide-Icons direkt als `<IconName />` gerendert werden statt über `AppIcon`,
3. irgendwo `fontSize: <Zahl>` steht statt eines Werts aus `authTypography`.
   Einzige Ausnahmen: das Wasserzeichen (96) und das Mini-Farb-Label (8) in `GameLobbyScreen.tsx`.

Farben und Abstände werden nicht vom Test erzwungen, gelten aber genauso. `node scripts/audit-design-system.cjs` zählt verbleibende Hex-Werte, feste Rundungen, Schatten und Abstände außerhalb der Skala.

## Farben (`authColors`, `src/theme/colors.ts`)

### Flächen

| Token             | Wert                       | Verwendung                            |
| ----------------- | -------------------------- | ------------------------------------- |
| `background`      | `#07110B`                  | Seitenhintergrund                     |
| `backgroundSoft`  | `#0A1710`                  | Leicht abgesetzte Bereiche            |
| `surface`         | `#0D1B13`                  | Karten                                |
| `surfaceElevated` | `rgba(13, 27, 19, 0.78)`   | Schwebende, halbtransparente Karten   |
| `selectedSurface` | `rgba(212, 175, 55, 0.22)` | Ausgewählter Zustand (Gold-Tönung)    |
| `overlay`         | `rgba(0, 0, 0, 0.6)`       | Abdunklung hinter Sheets und Dialogen |
| `dangerSurface`   | `#692B2C`                  | Fläche für destruktive Bestätigungen  |
| `disabled`        | `#34443A`                  | Deaktivierte Flächen                  |

**Tisch-Screens** (Lobby, laufendes Spiel, Tisch anlegen/bearbeiten):

| Token                 | Wert      |
| --------------------- | --------- |
| `tableBackground`     | `#0B1D16` |
| `tableBackgroundMid`  | `#10241C` |
| `tableBackgroundSoft` | `#163328` |
| `tableCard`           | `#1A2D24` |
| `tableCardElevated`   | `#20372D` |

### Akzente

| Token           | Wert      | Verwendung                     |
| --------------- | --------- | ------------------------------ |
| `gold`          | `#D4AF37` | Primärfarbe, Hauptaktionen     |
| `goldHighlight` | `#F2C94C` | Hervorhebungen, Primär-Buttons |
| `onGold`        | `#17150B` | Text/Icons auf Gold            |
| `accentGreen`   | `#6BA36E` | Positive Werte, Gewinn         |
| `error`         | `#F87171` | Fehler, negative Werte         |
| `onDanger`      | `#07110B` | Text auf Fehlerfarbe           |

### Text

| Token            | Wert                        | Verwendung                    |
| ---------------- | --------------------------- | ----------------------------- |
| `textPrimary`    | `#F5F5F5`                   | Standardtext                  |
| `textSecondary`  | `#A1A1A1`                   | Nebentext, Captions           |
| `textMuted`      | `rgba(245, 245, 245, 0.62)` | Hinweise, sekundäre Zeilen    |
| `textMutedGreen` | `#A8B9AD`                   | Gedämpfter Text mit Grünstich |
| `textFaint`      | `rgba(245, 245, 245, 0.38)` | Platzhalter, inaktive Labels  |
| `errorText`      | `#FCA5A5`                   | Fehlermeldungen               |

### Rahmen, Eingaben, Bedienelemente

| Token              | Wert                        |
| ------------------ | --------------------------- |
| `borderSoft`       | `rgba(245, 245, 245, 0.08)` |
| `borderGold`       | `rgba(212, 175, 55, 0.42)`  |
| `listSeparator`    | `rgba(107, 163, 110, 0.25)` |
| `inputFill`        | `rgba(13, 27, 19, 0.72)`    |
| `inputBorder`      | `#536D57`                   |
| `inputFocused`     | `rgba(212, 175, 55, 0.72)`  |
| `control`          | `rgba(22, 51, 40, 0.8)`     |
| `controlMuted`     | `rgba(22, 51, 40, 0.72)`    |
| `controlBorder`    | `rgba(107, 163, 110, 0.2)`  |
| `controlSeparator` | `rgba(245, 245, 245, 0.15)` |
| `errorBackground`  | `rgba(127, 29, 29, 0.18)`   |
| `errorBorder`      | `rgba(248, 113, 113, 0.72)` |
| `shadow`           | `#000000`                   |
| `transparent`      | `transparent`               |

### Kartenfarben

| Token          | Wert      | Farbe    |
| -------------- | --------- | -------- |
| `suitEichel`   | `#C8944D` | Eichel   |
| `suitGras`     | `#6BA36E` | Gras     |
| `suitHerz`     | `#E0635C` | Herz     |
| `suitSchellen` | `#F2C94C` | Schellen |

Flächen und Rahmen der Farbauswahl: `suitSurface` (`rgba(16, 43, 32, 0.65)`), `suitBorder` (`rgba(107, 163, 110, 0.15)`).

## Typografie (`src/theme/typography.ts`)

**Schrift:** Inter in sechs Schnitten (400 Regular bis 900 Black), geladen in `App.tsx`. `fontFamilyForWeight()` wählt zum `fontWeight` den passenden Schnitt; `AppText` erledigt das automatisch.

### Schriftgrößen (`authTypography`)

| Token      | Größe | Typische Verwendung                   |
| ---------- | ----: | ------------------------------------- |
| `amount`   |    36 | Große Geldbeträge                     |
| `hero`     |    34 | Große Überschriften                   |
| `title`    |    28 | Seitentitel                           |
| `metric`   |    24 | Kennzahlen                            |
| `subtitle` |    20 | Zwischenüberschriften, Dialogtitel    |
| `subhead`  |    18 | Unterzeilen, Zähler                   |
| `button`   |    17 | Button-Text                           |
| `body`     |    16 | Fließtext, Eingabefelder              |
| `label`    |    15 | Labels                                |
| `caption`  |    13 | Hinweise, Beschriftungen              |
| `control`  |    12 | Segment-Regler, kleine Bedienelemente |
| `tiny`     |    11 | Sehr kleine Hinweise                  |
| `micro`    |    10 | Badges und Labels in kleinen Chips    |

### Textstile (`authTextStyles`, über `<AppText variant="…">`)

| Variante             | Größe | Gewicht | Besonderheit                   |
| -------------------- | ----: | ------- | ------------------------------ |
| `pageTitle`          |    28 | 600     | Zeilenhöhe 36, `textPrimary`   |
| `balanceHero`        |    48 | 600     | Tabellarische Ziffern          |
| `balanceHeroCompact` |    40 | 600     | Tabellarische Ziffern          |
| `amount`             |    36 | 800     | Tabellarische Ziffern          |
| `hero`               |    34 | 800     |                                |
| `title`              |    28 | 700     |                                |
| `metric`             |    24 | 700     | Tabellarische Ziffern          |
| `subtitle`           |    20 | 600     |                                |
| `subhead`            |    18 | 400     |                                |
| `counter`            |    18 | –       | Tabellarische Ziffern          |
| `button`             |    17 | 800     |                                |
| `body`               |    16 | –       | Standard von `AppText`         |
| `label`              |    15 | –       |                                |
| `caption`            |    13 | –       | Zeilenhöhe 18, `textSecondary` |
| `control`            |    12 | –       |                                |
| `tiny`               |    11 | –       | `textSecondary`                |

**Zahlen und Beträge** immer mit tabellarischen Ziffern (`fontVariant: ['tabular-nums']`), damit Spalten nicht springen. Systemweite Schriftvergrößerung wird nicht deaktiviert.

## Abstände und Größen (`src/theme/spacing.ts`)

### Abstände (`authSpacing`)

| Token    | Wert |
| -------- | ---: |
| `xs`     |    4 |
| `sm`     |    8 |
| `md`     |   12 |
| `lg`     |   16 |
| `lgPlus` |   20 |
| `xl`     |   24 |
| `xxl`    |   32 |
| `xxxl`   |   44 |

### Rundungen (`authRadius`)

| Token  | Wert |
| ------ | ---: |
| `sm`   |   16 |
| `md`   |   18 |
| `lg`   |   22 |
| `xl`   |   28 |
| `pill` |  999 |

Rundung 0 ist nur beim Segment-Regler gewollt.

### Größen von Bedienelementen (`authControlSizes`)

| Token           | iOS | Android | Verwendung                    |
| --------------- | --: | ------: | ----------------------------- |
| `touch`         |  44 |      48 | Mindestgröße jeder Tippfläche |
| `field`         |  48 |      48 | Eingabefelder                 |
| `primaryButton` |  60 |      60 | Haupt-Buttons                 |
| `playerRow`     |  64 |      64 | Spielerzeilen                 |
| `suit`          |  68 |      68 | Farb-Kacheln                  |
| `stepper`       |  96 |     100 | Stepper                       |
| `counter`       |  28 |      28 | Zähler                        |
| `icon`          |  24 |      24 | Icon-Fläche                   |

### Interaktion (`authInteraction`)

- Gedrückt: `opacity: 0.8`
- Deaktiviert: `opacity: 0.5`

## Schatten (`authShadows`, `src/theme/shadows.ts`)

| Token  | Wert                                  | Verwendung            |
| ------ | ------------------------------------- | --------------------- |
| `card` | `0 2px 8px rgba(0, 0, 0, 0.12)`       | Karten                |
| `gold` | `0 4px 12px rgba(212, 175, 55, 0.16)` | Goldene Hauptaktionen |

Schatten über `boxShadow`, nicht über die alten `shadowColor`/`shadowOffset`/`elevation`-Eigenschaften.

## Icons (`src/theme/icons.ts`)

Nur **Lucide** (`lucide-react-native`), immer über `AppIcon`:

```tsx
<AppIcon icon={Plus} size="md" weight="regular" />
```

| Größe |  px | Verwendung                                       |
| ----- | --: | ------------------------------------------------ |
| `xs`  |  14 | Badges, kleine Chips                             |
| `sm`  |  18 | Neben kleinem Text, Suchfelder, kompakte Buttons |
| `md`  |  20 | Standard: Listenzeilen, Toolbar, Menüs           |
| `lg`  |  24 | Header-, Schließen-Buttons, Tab-Bar              |
| `xl`  |  28 | Große runde Aktions-Buttons, leere Zustände      |

| Strichstärke | Wert | Verwendung                                    |
| ------------ | ---: | --------------------------------------------- |
| `regular`    |    2 | Standard                                      |
| `strong`     |  2.5 | Ausgewählt, auf Gold, kleine gefüllte Buttons |

## Bewegung (`src/theme/motion.ts`)

| Animation           |  Dauer | Verwendung                    |
| ------------------- | -----: | ----------------------------- |
| `formEntering`      | 240 ms | Einblenden von Formularen     |
| `selectionEntering` | 140 ms | Einblenden nach einer Auswahl |

Beide als Fade-In ohne Verzögerung mit Ease-out (`bezier(0.23, 1, 0.32, 1)`). Sie respektieren die System-Einstellung „Bewegung reduzieren“.

## Kompatibilität für ältere Screens

`theme` aus `src/theme/index.ts` stellt alte Namen bereit (`theme.colors.primary`, `theme.colors.text`, `theme.spacing`, `theme.radius`, `theme.typography` …). Alle Werte zeigen auf dieselben Tokens wie oben. Neuer Code verwendet direkt `authColors`, `authSpacing` usw.

| Alter Name                   | Zeigt auf        |
| ---------------------------- | ---------------- |
| `colors.background`          | `background`     |
| `colors.surface`             | `surface`        |
| `colors.surfaceMuted`        | `backgroundSoft` |
| `colors.border`              | `borderSoft`     |
| `colors.text`                | `textPrimary`    |
| `colors.textMuted`           | `textSecondary`  |
| `colors.primary`             | `goldHighlight`  |
| `colors.primaryText`         | `onGold`         |
| `colors.secondary`           | `control`        |
| `colors.secondaryText`       | `textPrimary`    |
| `colors.danger` / `negative` | `error`          |
| `colors.dangerText`          | `onDanger`       |
| `colors.positive`            | `accentGreen`    |
| `colors.disabled`            | `disabled`       |
| `colors.disabledText`        | `textSecondary`  |
