import { ScrollView, StyleSheet } from 'react-native';

import { AuthBackground } from '../components/auth/AuthBackground';
import { AppText } from '../components/ui/AppText';
import { Notice } from '../components/ui/Notice';
import { PageHeader } from '../components/ui/PageHeader';
import { type LegalPage, legalPages } from '../constants/legal';
import { authColors, authSpacing } from '../theme';

export function LegalScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void };
  route: { params: { page: LegalPage } };
}) {
  const page = legalPages[route.params.page];
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
    fontSize: 15,
    lineHeight: 22,
  },
});
