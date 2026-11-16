import { continueRender, delayRender, staticFile } from 'remotion';

// Dieselben Inter-Dateien, die auch die App lädt (@expo-google-fonts/inter).
const weights = [500, 600, 700, 800, 900];
let started = false;

export function loadFonts() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Inter laden');
  Promise.all(
    weights.map(async (weight) => {
      const face = new FontFace('Inter', `url(${staticFile(`fonts/Inter-${weight}.ttf`)})`, {
        weight: String(weight),
      });
      document.fonts.add(await face.load());
    }),
  )
    .then(() => continueRender(handle))
    .catch((error) => {
      console.error(error);
      continueRender(handle);
    });
}
