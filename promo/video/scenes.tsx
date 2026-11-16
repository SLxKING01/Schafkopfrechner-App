import { Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';

import { AppIcon, Headline, Phone, PlayingCard, Scene, SuitIcon } from './components';
import { BAR, BEAT, colors, easeOut, ENTER, font, pop, ramp, SAFE, type SuitId, tokens, WIDTH } from './lib';

const { taps, boxes } = tokens;
const CENTER = (SAFE.left + SAFE.right) / 2;
const SUITS: SuitId[] = ['eichel', 'gras', 'herz', 'schellen'];

/* ───────────── Szene 1: Hook „Der Rechenstreit“ (0–2 s) ───────────── */
export function Hook() {
  const frame = useCurrentFrame();
  const rows = [
    { label: 'Rufspiel', value: '0,20 €', at: 0 },
    { label: 'Schneider', value: '+ 0,10 €', at: BEAT },
    { label: '3 Laufende', value: '+ 0,30 €', at: 2 * BEAT },
  ];
  const solved = frame >= 3 * BEAT;
  const snap = pop(frame, 3 * BEAT, 8);
  const wobble = Math.sin(frame / 1.6) * 7;
  return (
    <Scene>
      <Headline lines={['Schneider, drei', 'Laufende … macht?']} top={285} size={88} instant />
      <div style={{ position: 'absolute', left: 150, width: 720, top: 640 }}>
        {rows.map((row, index) => {
          const t = index === 0 ? 1 : pop(frame, row.at, 7);
          return (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '26px 0',
                borderBottom: `2px solid ${colors.listSeparator}`,
                opacity: Math.min(1, t),
                transform: `scale(${0.9 + 0.1 * t})`,
                transformOrigin: 'left center',
              }}
            >
              <span style={{ ...font(600), fontSize: 58, color: colors.textMutedGreen }}>{row.label}</span>
              <span style={{ ...font(800), fontSize: 68, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                {row.value}
              </span>
            </div>
          );
        })}
        <div style={{ height: 6, marginTop: 28, borderRadius: 3, backgroundColor: colors.gold, opacity: ramp(frame, 2 * BEAT + 4, 5), transformOrigin: 'left', transform: `scaleX(${ramp(frame, 2 * BEAT + 4, 8)})` }} />
        <div
          style={{
            marginTop: 40,
            textAlign: 'center',
            ...font(900),
            fontSize: solved ? 190 : 230,
            lineHeight: 1,
            letterSpacing: -6,
            color: solved ? colors.goldHighlight : colors.textPrimary,
            opacity: solved ? Math.min(1, snap) : ramp(frame, 2 * BEAT + 6, 5),
            transform: solved ? `scale(${0.7 + 0.3 * snap})` : `rotate(${wobble}deg)`,
            textShadow: solved ? '0 0 70px rgba(242,201,76,0.45)' : 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {solved ? '0,60 €' : '?'}
        </div>
      </div>
    </Scene>
  );
}

/* ───────────── Szene 2: Auflösung (2–4 s) ───────────── */
function CardFan({ start, top, width = 250, spread = 1 }: { start: number; top: number; width?: number; spread?: number }) {
  const frame = useCurrentFrame();
  return (
    <>
      {SUITS.map((id, index) => {
        const t = ramp(frame, start + index * 2, 10);
        const offset = index - 1.5;
        return (
          <PlayingCard
            key={id}
            id={id}
            width={width}
            style={{
              left: CENTER - width / 2 + offset * 150 * spread * t,
              top: top + Math.abs(offset) * 34 * t,
              opacity: t,
              transform: `rotate(${offset * 11 * t}deg)`,
              transformOrigin: '50% 120%',
            }}
          />
        );
      })}
    </>
  );
}

export function Resolve({ icon }: { icon: 'assets-icon' | 'app-logo' }) {
  const frame = useCurrentFrame();
  const t = pop(frame, 0, 9);
  return (
    <Scene>
      <Headline lines={['Des rechnet jetzt', 'die App.']} top={300} />
      <CardFan start={BEAT} top={760} />
      <div style={{ position: 'absolute', left: CENTER - 150, top: 880, transform: `scale(${t})`, opacity: Math.min(1, t) }}>
        <AppIcon size={300} source={icon} />
      </div>
    </Scene>
  );
}

/* ───────────── Szenen 3–5: Runde erfassen (4–10 s) ───────────── */
const PHONE_W = 640;
const PHONE_LEFT = CENTER - PHONE_W / 2;
const PHONE_TOP = 530;

export function Erfassen() {
  const frame = useCurrentFrame();
  const enter = ramp(frame, 0, 12);
  // Kamera: Zoom auf die automatisch berechneten Beträge, dann zurück zum Tisch.
  const zoom = interpolate(frame, [2 * BAR, 2 * BAR + 10, 2 * BAR + 26, 2 * BAR + 30], [1, 1.32, 1.32, 1], {
    easing: easeOut,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lift = interpolate(zoom, [1, 1.32], [0, 150]);
  return (
    <Scene>
      <Sequence durationInFrames={BAR} layout="none">
        <Headline lines={['Spiel eintragen.', 'Fertig.']} />
      </Sequence>
      <Sequence from={BAR} durationInFrames={BAR} layout="none">
        <Headline lines={['Rufspiel. Wenz.', 'Solo.']} />
      </Sequence>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: WIDTH,
          height: 1920,
          transform: `translateY(${(1 - enter) * 1400 + lift}px) scale(${zoom})`,
          transformOrigin: `${CENTER}px ${PHONE_TOP + 260}px`,
        }}
      >
        <Phone
          width={PHONE_W}
          style={{ left: PHONE_LEFT, top: PHONE_TOP }}
          shots={[
            { name: '03-tisch', from: 0 },
            { name: '04-spielauswahl', from: 3 * BEAT },
            { name: '05-solo', from: BAR + BEAT },
            { name: '06-herzsolo', from: BAR + 2 * BEAT },
            { name: '07-laufende', from: BAR + 3 * BEAT },
            { name: '08-schneider', from: 2 * BAR },
            { name: '09-tisch-nachher', from: 2 * BAR + 2 * BEAT },
          ]}
          taps={[
            { at: 3 * BEAT - 5, ...taps.ansager },
            { at: BAR + BEAT - 5, ...taps.solo },
            { at: BAR + 2 * BEAT - 5, x: taps.herz.x, y: taps.herz.y + 230 },
            { at: BAR + 3 * BEAT - 5, ...taps.laufende },
            { at: 2 * BAR - 5, ...taps.schneider },
            { at: 2 * BAR + 2 * BEAT - 5, ...taps.speichern },
          ]}
          highlights={[
            { from: 2 * BAR + 3, to: 2 * BAR + 2 * BEAT, box: boxes.betrag },
            { from: 2 * BAR + 2 * BEAT + 3, box: boxes.saldoSepp },
          ]}
        />
      </div>
      <Sequence from={2 * BAR} durationInFrames={BAR} layout="none">
        <Headline lines={['Rechnet', 'von selbst.']} />
      </Sequence>
    </Scene>
  );
}

/* ───────────── Szenen 6–8: Gemeinsame Tische (10–16 s) ───────────── */
function LiveChip({ name, at, active, left }: { name: string; at: number; active: boolean; left: number }) {
  const frame = useCurrentFrame();
  const t = pop(frame, at, 8);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: 560,
        width: 190,
        height: 76,
        borderRadius: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        backgroundColor: active ? colors.goldHighlight : colors.control,
        border: `2px solid ${active ? colors.goldHighlight : colors.controlBorder}`,
        color: active ? colors.onGold : colors.textPrimary,
        ...font(700),
        fontSize: 36,
        opacity: Math.min(1, t),
        transform: `scale(${t})`,
      }}
    >
      <span style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: active ? colors.onGold : colors.accentGreen }} />
      {name}
    </div>
  );
}

export function Tische() {
  const frame = useCurrentFrame();
  const W = 470;
  const enter = ramp(frame, 0, 12);
  const leftX = 36;
  const rightX = 530;
  const top = 700;
  // Goldener Impuls läuft nach dem Speichern von Sepps zu Vronis Handy.
  const pulseStart = BAR + 2 * BEAT;
  const pulse = interpolate(frame, [pulseStart, 2 * BAR], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulseVisible = frame >= pulseStart && frame < 2 * BAR + 4;
  const glowLeft = interpolate(frame, [pulseStart, pulseStart + 6, pulseStart + 24], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glowRight = interpolate(frame, [2 * BAR, 2 * BAR + 6, 2 * BAR + 30], [0, 1, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const names = ['Sepp', 'Vroni', 'Hias', 'Resi'];
  const active = frame >= 2 * BAR ? 'Vroni' : frame >= BAR ? 'Sepp' : '';
  return (
    <Scene>
      <Sequence durationInFrames={BAR} layout="none">
        <Headline lines={['Ein Tisch.', 'Alle live dabei.']} />
      </Sequence>
      <Sequence from={BAR} durationInFrames={BAR} layout="none">
        <Headline lines={['Sepp', 'trägt ein.']} gold={0} />
      </Sequence>
      <Sequence from={2 * BAR} durationInFrames={BAR} layout="none">
        <Headline lines={['Vroni', 'sieht’s sofort.']} gold={0} />
      </Sequence>
      {names.map((name, index) => (
        <LiveChip key={name} name={name} at={index * BEAT} active={active === name} left={105 + index * 205} />
      ))}
      <Phone
        width={W}
        style={{ left: leftX - (1 - enter) * 600, top, transform: 'rotate(-3deg)' }}
        glow={glowLeft}
        shots={[
          { name: '03-tisch', from: 0 },
          { name: '08-schneider', from: BAR },
          { name: '09-tisch-nachher', from: BAR + 2 * BEAT },
        ]}
        taps={[{ at: BAR + 2 * BEAT - 5, ...taps.speichern }]}
        highlights={[{ from: BAR + 2 * BEAT + 3, to: 2 * BAR, box: boxes.saldoSepp }]}
      />
      <Phone
        width={W}
        style={{ left: rightX + (1 - enter) * 600, top: top + 30, transform: 'rotate(3deg)' }}
        glow={glowRight}
        shots={[
          { name: 'v1-tisch-vorher', from: 0 },
          { name: 'v4-tisch-nachher', from: 2 * BAR },
          { name: 'v3-verlauf-nachher', from: 2 * BAR + 2 * BEAT },
        ]}
        highlights={[
          { from: 2 * BAR + 2, to: 2 * BAR + 2 * BEAT, box: boxes.saldoVroni },
          { from: 2 * BAR + 2 * BEAT + 2, box: { ...boxes.neueZeile, width: 370, height: 34 }, pad: 6 },
        ]}
      />
      {pulseVisible ? (
        <div
          style={{
            position: 'absolute',
            left: interpolate(pulse, [0, 1], [leftX + W / 2, rightX + W / 2]) - 28,
            top: top + 330 - Math.sin(pulse * Math.PI) * 120,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.goldHighlight,
            boxShadow: '0 0 60px 18px rgba(242,201,76,0.6)',
            opacity: interpolate(pulse, [0, 0.08, 0.9, 1], [0, 1, 1, 0]),
          }}
        />
      ) : null}
    </Scene>
  );
}

/* ───────────── Szenen 9–11: Statistik (16–22 s) ───────────── */
export function Statistik() {
  const frame = useCurrentFrame();
  const enter = ramp(frame, 0, 12);
  const zoom = interpolate(frame, [0, 12, BAR - 4, BAR + 6], [1, 1.14, 1.14, 1], { easing: easeOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Scene>
      <Sequence durationInFrames={BAR} layout="none">
        <Headline lines={['Wer', 'räumt ab?']} />
      </Sequence>
      <Sequence from={BAR} durationInFrames={BAR} layout="none">
        <Headline lines={['Die Statistik', 'weiß es.']} />
      </Sequence>
      <Sequence from={2 * BAR} durationInFrames={BAR} layout="none">
        <Headline lines={['Spielmacher', 'oder Mitläufer?']} size={88} />
      </Sequence>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(${(1 - enter) * 1100}px) scale(${zoom})`,
          transformOrigin: `${CENTER}px ${PHONE_TOP}px`,
        }}
      >
        <Phone
          width={PHONE_W}
          style={{ left: PHONE_LEFT, top: PHONE_TOP }}
          shots={[
            { name: '11-statistik-sepp', from: 0 },
            { name: '11-statistik-vroni', from: BEAT },
            { name: '11-statistik-hias', from: 2 * BEAT },
            { name: '11-statistik-resi', from: 3 * BEAT },
            { name: '10-statistik-gesamt', from: BAR },
            { name: '13-statistik-spielarten', from: BAR + 2 * BEAT },
            { name: '14-statistik-rollen', from: 2 * BAR },
            { name: '12-statistik-position', from: 2 * BAR + 2 * BEAT },
          ]}
          highlights={[{ from: BEAT + 2, to: 2 * BEAT, box: { ...boxes.bilanz, width: 150, height: 78 }, pad: 12 }]}
        />
      </div>
    </Scene>
  );
}

/* ───────────── Szene 12: Slogan (22–24 s) ───────────── */
export function Slogan() {
  const frame = useCurrentFrame();
  const width = 200;
  return (
    <Scene>
      <Headline lines={['Du spielst.', 'Die App rechnet.']} top={330} size={100} />
      {SUITS.map((id, index) => {
        const t = pop(frame, index * BEAT, 8);
        const offset = index - 1.5;
        return (
          <PlayingCard
            key={id}
            id={id}
            width={width}
            style={{
              left: CENTER - width / 2 + offset * 205,
              top: 800 + (index % 2) * 40 + (1 - Math.min(1, t)) * 260,
              opacity: Math.min(1, t * 1.4),
              transform: `rotate(${offset * 5}deg) scale(${0.8 + 0.2 * t})`,
            }}
          />
        );
      })}
    </Scene>
  );
}

/* ───────────── Szene 13: Schlusskarte (24–28 s) ───────────── */
export function EndCard({
  variant,
  icon,
  hasBadge,
  still = false,
}: {
  variant: 'soon' | 'live';
  icon: 'assets-icon' | 'app-logo';
  hasBadge: boolean;
  still?: boolean;
}) {
  const current = useCurrentFrame();
  const frame = still ? 999 : current;
  const iconIn = pop(frame, 0, 10);
  const nameIn = ramp(frame, BEAT, ENTER);
  const lineIn = ramp(frame, 2 * BEAT, ENTER);
  const showBadge = variant === 'live' && hasBadge;
  return (
    <Scene>
      <div style={{ position: 'absolute', left: CENTER - 160, top: 470, transform: `scale(${iconIn})`, opacity: Math.min(1, iconIn) }}>
        <AppIcon size={320} source={icon} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: SAFE.left,
          width: SAFE.right - SAFE.left,
          top: 870,
          textAlign: 'center',
          opacity: nameIn,
          transform: `translateY(${(1 - nameIn) * 30}px)`,
        }}
      >
        <div style={{ ...font(800), fontSize: 86, letterSpacing: -2.4, color: colors.textPrimary }}>Schafkopfrechner</div>
        <div style={{ ...font(500), fontSize: 44, marginTop: 18, color: colors.textMutedGreen }}>Du spielst. Die App rechnet.</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: SAFE.left,
          width: SAFE.right - SAFE.left,
          top: 1180,
          display: 'flex',
          justifyContent: 'center',
          opacity: lineIn,
          transform: `translateY(${(1 - lineIn) * 30}px)`,
        }}
      >
        {showBadge ? (
          <Img src={staticFile('app-store-badge.svg')} style={{ height: 150 }} />
        ) : (
          <div
            style={{
              padding: '30px 60px',
              borderRadius: 70,
              border: `3px solid ${colors.gold}`,
              backgroundColor: colors.selectedSurface,
              ...font(700),
              fontSize: 56,
              color: colors.goldHighlight,
            }}
          >
            {variant === 'live' ? 'Jetzt im App Store' : 'Bald im App Store'}
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: CENTER - 150, top: 1380, display: 'flex', gap: 28, width: 300, justifyContent: 'center', opacity: lineIn * 0.9 }}>
        {SUITS.map((id) => (
          <SuitIcon key={id} id={id} size={48} />
        ))}
      </div>
    </Scene>
  );
}
