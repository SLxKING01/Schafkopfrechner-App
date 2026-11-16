import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

import { colors, ENTER, font, HEIGHT, ramp, SAFE, suit, type SuitId, tokens, WIDTH } from './lib';

export function SuitIcon({ id, size, color }: { id: SuitId; size: number; color?: string }) {
  const s = suit(id);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d={s.path} fill={color ?? s.color} />
    </svg>
  );
}

/** Ruhiger App-Hintergrund mit den vier Farbsymbolen am Rand (wie das Dashboard). */
export function Background() {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 12;
  const motifs: { id: SuitId; x: number; y: number; angle: number; opacity: number }[] = [
    { id: 'eichel', x: 720, y: 60, angle: 18, opacity: 0.1 },
    { id: 'gras', x: -200, y: 560, angle: -22, opacity: 0.095 },
    { id: 'herz', x: 760, y: 1120, angle: 14, opacity: 0.075 },
    { id: 'schellen', x: -90, y: 1560, angle: -16, opacity: 0.09 },
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 900px at 50% 38%, rgba(107,163,110,0.16), transparent 70%), radial-gradient(700px 700px at 85% 95%, rgba(212,175,55,0.07), transparent 70%), linear-gradient(180deg, ${colors.backgroundSoft}, ${colors.background})`,
        }}
      />
      {motifs.map((m, index) => (
        <div
          key={m.id}
          style={{
            position: 'absolute',
            left: m.x,
            top: m.y + (index % 2 ? drift : -drift),
            opacity: m.opacity,
            transform: `rotate(${m.angle}deg)`,
          }}
        >
          <SuitIcon id={m.id} size={520} />
        </div>
      ))}
    </AbsoluteFill>
  );
}

/** Große Einblendung in der sicheren Zone. `gold` hebt die zweite Zeile hervor. */
export function Headline({
  lines,
  gold = 1,
  top = 290,
  size = 96,
  start = 0,
  instant = false,
}: {
  lines: string[];
  gold?: number;
  top?: number;
  size?: number;
  start?: number;
  instant?: boolean;
}) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE.left,
        width: SAFE.right - SAFE.left,
        top,
        textAlign: 'center',
        ...font(800),
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: -size * 0.025,
        color: colors.textPrimary,
      }}
    >
      {lines.map((line, index) => {
        const t = instant ? 1 : ramp(frame, start + index * 3, ENTER);
        return (
          <div
            key={line}
            style={{
              opacity: t,
              transform: `translateY(${(1 - t) * 36}px)`,
              color: index === gold ? colors.goldHighlight : colors.textPrimary,
              textShadow: '0 6px 30px rgba(0,0,0,0.55)',
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

export type Tap = { at: number; x: number; y: number };
export type Highlight = { from: number; to?: number; box: { x: number; y: number; width: number; height: number }; pad?: number };

/** Schlichter iPhone-Rahmen mit Dynamic Island. Zeigt Screenshots mit harten Schnitten. */
export function Phone({
  width,
  shots,
  taps = [],
  highlights = [],
  glow = 0,
  style,
}: {
  width: number;
  shots: { name: string; from: number }[];
  taps?: Tap[];
  highlights?: Highlight[];
  glow?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const bezel = width * 0.03;
  const screenW = width - bezel * 2;
  const unit = screenW / tokens.viewport.width;
  const screenH = tokens.viewport.height * unit;
  const radius = width * 0.15;
  const current = [...shots].reverse().find((s) => frame >= s.from) ?? shots[0];
  return (
    <div
      style={{
        position: 'absolute',
        width,
        height: screenH + bezel * 2,
        borderRadius: radius,
        background: 'linear-gradient(145deg, #3a3d3a, #101211 45%, #2a2c2a)',
        boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.10) inset, 0 0 ${60 + glow * 60}px rgba(242,201,76,${0.06 + glow * 0.38})`,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: bezel,
          top: bezel,
          width: screenW,
          height: screenH,
          borderRadius: radius - bezel,
          overflow: 'hidden',
          backgroundColor: colors.background,
          boxShadow: '0 0 0 3px #000',
        }}
      >
        <Img
          src={staticFile(`shots/${current.name}.png`)}
          style={{ width: screenW, height: screenH, display: 'block' }}
        />
        {highlights.map((h, index) => {
          if (frame < h.from || (h.to !== undefined && frame >= h.to)) return null;
          const pad = h.pad ?? 8;
          const t = ramp(frame, h.from, 6);
          const pulse = 0.75 + 0.25 * Math.sin((frame - h.from) / 3.2);
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: (h.box.x - pad) * unit,
                top: (h.box.y - pad) * unit,
                width: (h.box.width + pad * 2) * unit,
                height: (h.box.height + pad * 2) * unit,
                borderRadius: 12 * unit,
                border: `${3 * unit}px solid ${colors.goldHighlight}`,
                opacity: t * pulse,
                transform: `scale(${1.25 - 0.25 * t})`,
                boxShadow: `0 0 ${28 * unit}px rgba(242,201,76,0.55)`,
              }}
            />
          );
        })}
        {taps.map((tap, index) => {
          const local = frame - tap.at;
          if (local < 0 || local > 11) return null;
          const t = local / 11;
          const size = interpolate(t, [0, 1], [34, 96]) * unit;
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: tap.x * unit - size / 2,
                top: tap.y * unit - size / 2,
                width: size,
                height: size,
                borderRadius: size,
                backgroundColor: `rgba(242,201,76,${0.55 * (1 - t)})`,
                border: `${2.5 * unit}px solid rgba(242,201,76,${1 - t})`,
              }}
            />
          );
        })}
        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute',
            left: (tokens.viewport.width / 2 - 60) * unit,
            top: 11 * unit,
            width: 120 * unit,
            height: 35 * unit,
            borderRadius: 20 * unit,
            backgroundColor: '#000',
          }}
        />
      </div>
    </div>
  );
}

/** Eigene, stilisierte Spielkarte: nur Farbsymbol, keine Bildkarten echter Blätter. */
export function PlayingCard({ id, width, style }: { id: SuitId; width: number; style?: CSSProperties }) {
  const height = width * 1.52;
  const s = suit(id);
  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        borderRadius: width * 0.11,
        background: `linear-gradient(160deg, #163328, ${colors.surface} 70%)`,
        border: `${Math.max(2, width * 0.01)}px solid ${colors.borderGold}`,
        boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', left: width * 0.08, top: width * 0.08 }}>
        <SuitIcon id={id} size={width * 0.16} />
      </div>
      <div style={{ position: 'absolute', right: width * 0.08, bottom: width * 0.08, transform: 'rotate(180deg)' }}>
        <SuitIcon id={id} size={width * 0.16} />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: width * 0.14,
          borderRadius: width * 0.07,
          border: `1px solid ${s.color}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SuitIcon id={id} size={width * 0.5} />
      </div>
    </div>
  );
}

/** App-Zeichen: wahlweise `assets/icon.png` oder das Eichel-Logo aus der App (`AuthLogo`). */
export function AppIcon({ size, source }: { size: number; source: 'assets-icon' | 'app-logo' }) {
  const radius = size * 0.225;
  const shadow = `0 ${size * 0.08}px ${size * 0.3}px rgba(212,175,55,0.28), 0 ${size * 0.06}px ${size * 0.2}px rgba(0,0,0,0.5)`;
  if (source === 'assets-icon')
    return (
      <Img
        src={staticFile('icon.png')}
        style={{ width: size, height: size, borderRadius: radius, boxShadow: shadow }}
      />
    );
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(150deg, ${colors.goldHighlight}, ${colors.gold})`,
        border: '2px solid rgba(242, 201, 76, 0.58)',
        boxShadow: shadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SuitIcon id="eichel" size={size * 0.6} color={colors.background} />
    </div>
  );
}

export function Scene({ children }: { children: ReactNode }) {
  return <AbsoluteFill style={{ width: WIDTH, height: HEIGHT }}>{children}</AbsoluteFill>;
}
