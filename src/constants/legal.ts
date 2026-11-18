import { Linking } from 'react-native';

export type LegalLink = {
  key: 'privacy' | 'imprint';
  title: string;
  url: string;
};

// Expo inlines EXPO_PUBLIC_* only for static property access, so both are read explicitly.
const configured = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_URL,
  imprint: process.env.EXPO_PUBLIC_IMPRINT_URL,
};

export function validLegalUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function buildLegalLinks(source: {
  privacy?: string;
  imprint?: string;
}): LegalLink[] {
  const links: LegalLink[] = [];
  const privacy = validLegalUrl(source.privacy);
  const imprint = validLegalUrl(source.imprint);
  if (privacy)
    links.push({ key: 'privacy', title: 'Datenschutz', url: privacy });
  if (imprint) links.push({ key: 'imprint', title: 'Impressum', url: imprint });
  return links;
}

/** Links without a valid https URL are left out, so no dead entry ships. */
export const legalLinks = buildLegalLinks(configured);

export function openLegalLink(link: LegalLink) {
  return Linking.openURL(link.url).catch(() => undefined);
}
