import { ScrollView, StyleSheet } from 'react-native';

import { AuthBackground } from '../components/auth/AuthBackground';
import { GoldButton } from '../components/auth/GoldButton';
import { AppText } from '../components/ui/AppText';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import {
  legalLinkFor,
  type LegalPage,
  legalPages,
  openLegalLink,
} from '../constants/legal';
import { authColors, authSpacing } from '../theme';
import { authTypography } from '../theme/typography';

export function LegalScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void };
  route: { params: { page: LegalPage } };
}) {
  const page = legalPages[route.params.page];
  // The full text is published on the website; the app shows it in-app once a
  // copy is stored in `legalPages`, otherwise it links to the website.
  const link = legalLinkFor(route.params.page);
  return (
    <AuthBackground withEdgeBorder={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader title={page.title} onBack={() => navigation.goBack()} />
        {page.paragraphs.length ? (
          page.paragraphs.map((paragraph, index) => (
            <AppText key={index} selectable style={styles.paragraph}>
              {paragraph}
            </AppText>
          ))
        ) : link ? (
          <>
            <AppText style={styles.paragraph}>
              Der vollständige Text steht auf unserer Website.
            </AppText>
            <GoldButton
              title={`${page.title} öffnen`}
              onPress={() => void openLegalLink(link)}
            />
          </>
        ) : (
          <Notice tone="info">Dieser Text wird gerade erstellt.</Notice>
        )}
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: authSpacing.lg,
    paddingBottom: authSpacing.xxxl,
    paddingHorizontal: authSpacing.xl,
  },
  paragraph: {
    color: authColors.textPrimary,
    fontSize: authTypography.label,
    lineHeight: 22,
  },
});
