import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { authColors } from '../../theme/colors';
import {
  phonePresets,
  phonePreviewScale,
  phonePreviewUrl,
  shouldShowPhonePreview,
} from './phonePreview';

/** A real iframe viewport keeps window dimensions, fixed overlays and modals mobile-sized. */
export function AppViewport({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const [href] = useState(() => window.location.href);
  const [device, setDevice] = useState(1);
  const [frame, setFrame] = useState(true);
  const [originalSize, setOriginalSize] = useState(false);
  const [source] = useState(() => phonePreviewUrl(window.location.href));
  // Keep the same app document mounted when a desktop window is resized.
  const [preview] = useState(
    () =>
      shouldShowPhonePreview(window.location.href, window.innerWidth) &&
      !window.matchMedia('(pointer: coarse)').matches,
  );
  if (!preview) return <>{children}</>;

  const preset = phonePresets[device];
  const scale = originalSize
    ? 1
    : phonePreviewScale(width, height, preset.width, preset.height);
  const fullScreen = new URL(href);
  fullScreen.searchParams.set('preview', 'off');

  return (
    <main
      style={{
        ...styles.shell,
        height: '100dvh',
        minHeight: '100dvh',
        overflow: originalSize ? 'auto' : 'hidden',
      }}
    >
      <header style={styles.toolbar}>
        <div style={styles.caption}>
          <strong>Handyvorschau</strong>
          <span>
            {preset.width} × {preset.height}
          </span>
        </div>
        <div role="group" aria-label="Handygröße" style={styles.controls}>
          {phonePresets.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={device === index}
              onClick={() => setDevice(index)}
              style={{
                ...styles.button,
                ...(device === index ? styles.active : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div style={styles.controls}>
          <button
            type="button"
            aria-pressed={frame}
            onClick={() => setFrame(!frame)}
            style={styles.button}
          >
            {frame ? 'Rahmen ausblenden' : 'Rahmen anzeigen'}
          </button>
          <button
            type="button"
            aria-pressed={originalSize}
            onClick={() => setOriginalSize(!originalSize)}
            style={styles.button}
          >
            {originalSize ? 'An Fenster anpassen' : 'Originalgröße'}
          </button>
          <a
            href={fullScreen.href}
            style={{ ...styles.button, ...styles.link }}
          >
            Vollbild
          </a>
        </div>
      </header>
      <div style={{ ...styles.stage, minHeight: (preset.height + 20) * scale }}>
        <div
          style={{
            width: (preset.width + 20) * scale,
            height: (preset.height + 20) * scale,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              ...styles.phone,
              width: preset.width,
              height: preset.height,
              transform: `scale(${scale})`,
              borderColor: frame ? '#303833' : 'transparent',
              borderRadius: frame ? 46 : 10,
              boxShadow: frame ? '0 18px 64px rgba(0,0,0,.5)' : 'none',
            }}
          >
            <iframe
              title="Schafkopfrechner – Handyvorschau"
              src={source}
              style={{
                width: preset.width,
                height: preset.height,
                border: 0,
                display: 'block',
                borderRadius: frame ? 34 : 0,
                background: authColors.background,
              }}
            />
          </div>
        </div>
      </div>
      <p style={styles.hint}>
        Web-App im Handyformat · Änderungen werden automatisch aktualisiert
      </p>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    boxSizing: 'border-box',
    width: '100%',
    background: authColors.background,
    color: authColors.textPrimary,
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
    padding: '16px 24px 12px',
    gap: 12,
  },
  toolbar: {
    width: '100%',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexShrink: 0,
  },
  caption: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 14,
    marginRight: 8,
  },
  controls: { display: 'flex', alignItems: 'center', gap: 6 },
  button: {
    appearance: 'none',
    minHeight: 40,
    boxSizing: 'border-box',
    padding: '8px 12px',
    border: `1px solid ${authColors.borderGold}`,
    borderRadius: 12,
    background: authColors.surface,
    color: authColors.textPrimary,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
  },
  active: {
    background: authColors.goldHighlight,
    color: authColors.onGold,
    fontWeight: 700,
  },
  link: {
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  stage: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  phone: {
    boxSizing: 'content-box',
    border: '10px solid',
    background: authColors.background,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: 'top left',
  },
  hint: {
    color: authColors.textSecondary,
    fontSize: 12,
    margin: 0,
    textAlign: 'center',
    flexShrink: 0,
  },
};
