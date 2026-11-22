export type LegalPage = 'privacy' | 'imprint';

/**
 * Texts for the in-app legal pages. Each paragraph is one string.
 * The final wording is still to be supplied by the app owner; until then the
 * pages show a short notice instead of an invented legal text.
 */
export const legalPages: Record<
  LegalPage,
  { title: string; paragraphs: string[] }
> = {
  privacy: {
    title: 'Datenschutz',
    paragraphs: [],
  },
  imprint: {
    title: 'Impressum',
    paragraphs: [],
  },
};
