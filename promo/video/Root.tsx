import { AbsoluteFill, Composition, Sequence, Still } from 'remotion';

import { Background, Headline, Phone, PlayingCard } from './components';
import { loadFonts } from './fonts';
import { BAR, FPS, HEIGHT, SAFE, tokens, WIDTH } from './lib';
import { EndCard, Erfassen, Hook, Resolve, Slogan, Statistik, Tische } from './scenes';

loadFonts();

export type ReelProps = {
  /** "soon" = „Bald im App Store“, "live" = offizielles Badge (falls vorhanden). */
  endCard: 'soon' | 'live';
  /** "app-logo" = Eichel-Logo aus der App, "assets-icon" = assets/icon.png. */
  icon: 'assets-icon' | 'app-logo';
};

export const defaultProps: ReelProps = { endCard: 'soon', icon: 'app-logo' };

// Szenenplan in Takten (1 Takt = 2 s bei 120 BPM).
export const TIMELINE = [
  { id: 'hook', bars: 1 },
  { id: 'aufloesung', bars: 1 },
  { id: 'erfassen', bars: 3 },
  { id: 'tische', bars: 3 },
  { id: 'statistik', bars: 3 },
  { id: 'slogan', bars: 1 },
  { id: 'schluss', bars: 2 },
] as const;
export const TOTAL_FRAMES = TIMELINE.reduce((sum, s) => sum + s.bars, 0) * BAR;

function Reel({ endCard, icon }: ReelProps) {
  const scenes = {
    hook: <Hook />,
    aufloesung: <Resolve icon={icon} />,
    erfassen: <Erfassen />,
    tische: <Tische />,
    statistik: <Statistik />,
    slogan: <Slogan />,
    schluss: <EndCard variant={endCard} icon={icon} hasBadge={tokens.hasBadge} />,
  };
  let from = 0;
  return (
    <AbsoluteFill>
      <Background />
      {TIMELINE.map((scene) => {
        const start = from;
        from += scene.bars * BAR;
        return (
          <Sequence key={scene.id} name={scene.id} from={start} durationInFrames={scene.bars * BAR}>
            {scenes[scene.id]}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

/** Coverbild für Instagram: ruhiges Standbild mit Slogan, Handy und Karten. */
function Cover({ icon }: ReelProps) {
  const cx = (SAFE.left + SAFE.right) / 2;
  return (
    <AbsoluteFill>
      <Background />
      <Headline lines={['Du spielst.', 'Die App rechnet.']} top={300} size={100} instant />
      {(['eichel', 'gras'] as const).map((id, index) => (
        <PlayingCard key={id} id={id} width={230} style={{ left: 60 + index * 40, top: 800 + index * 330, transform: `rotate(${-14 + index * 6}deg)` }} />
      ))}
      {(['herz', 'schellen'] as const).map((id, index) => (
        <PlayingCard key={id} id={id} width={230} style={{ left: 760 - index * 40, top: 780 + index * 340, transform: `rotate(${12 - index * 5}deg)` }} />
      ))}
      <Phone width={560} style={{ left: cx - 280, top: 620 }} shots={[{ name: '09-tisch-nachher', from: 0 }]} />
      <div style={{ display: 'none' }}>{icon}</div>
    </AbsoluteFill>
  );
}

export function Root() {
  return (
    <>
      <Composition
        id="Reel"
        component={Reel}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={TOTAL_FRAMES}
        defaultProps={defaultProps}
      />
      <Still id="Cover" component={Cover} width={WIDTH} height={HEIGHT} defaultProps={defaultProps} />
    </>
  );
}
