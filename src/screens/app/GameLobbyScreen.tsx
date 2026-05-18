import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, Spade, Users } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthBackground } from '../../components/auth/AuthBackground';
import { GoldButton } from '../../components/auth/GoldButton';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { AppText } from '../../components/ui/AppText';
import type { AppStackParamList } from '../../navigation/types';
import { useGameStore } from '../../store/gameStore';
import { authColors } from '../../theme/colors';
import { authRadius, authSpacing } from '../../theme/spacing';
import { authTypography } from '../../theme/typography';

const gameTypes = ['Sauspiel', 'Wenz', 'Solo', 'Ramsch'];
type GameLobbyNavigationProp = NativeStackNavigationProp<AppStackParamList>;

export function GameLobbyScreen() {
  const navigation = useNavigation<GameLobbyNavigationProp>();
  const currentTable = useGameStore((state) => state.currentTable);
  const activeGame = useGameStore((state) => state.activeGame);

  function showPrepared() {
    Alert.alert(
      'Lobby vorbereitet',
      'Das echte Spielsystem wird hier an Supabase Spiele und Einladungen angeschlossen.',
    );
  }

  return (
    <AuthBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.kicker}>Spiel</AppText>
        <AppText style={styles.title}>Lobby vorbereiten</AppText>
        <AppText style={styles.subtitle}>
          Starte eine Runde, lade Freunde ein und waehle den Spieltyp.
        </AppText>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Spade color={authColors.goldHighlight} size={30} />
          </View>
          <AppText style={styles.heroTitle}>Neues Spiel starten</AppText>
          <AppText style={styles.heroCopy}>
            Schneller Einstieg fuer echte Spielabende mit Freunden.
          </AppText>
          <GoldButton
            title={
              activeGame && currentTable
                ? 'Aktives Spiel oeffnen'
                : 'Lobby erstellen'
            }
            onPress={() =>
              navigation.navigate(
                activeGame && currentTable ? 'ActiveGame' : 'CreateTable',
              )
            }
          />
        </View>

        <SectionHeader title="Spieler" action="Hinzufuegen" />
        <View style={styles.playerRow}>
          {['Simon', 'Max', 'Anna'].map((player) => (
            <View key={player} style={styles.playerChip}>
              <Users color={authColors.accentGreen} size={15} />
              <AppText style={styles.playerText}>{player}</AppText>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={showPrepared}
            style={styles.addChip}
          >
            <Plus color={authColors.gold} size={16} />
          </Pressable>
        </View>

        <SectionHeader title="Spieltyp waehlen" />
        <View style={styles.typeGrid}>
          {gameTypes.map((type, index) => (
            <Pressable
              key={type}
              accessibilityRole="button"
              onPress={showPrepared}
              style={[styles.typeCard, index === 0 && styles.typeCardActive]}
            >
              <AppText
                style={[styles.typeText, index === 0 && styles.typeTextActive]}
              >
                {type}
              </AppText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
    paddingHorizontal: authSpacing.xl,
    paddingTop: authSpacing.xl,
  },
  kicker: {
    color: authColors.goldHighlight,
    fontSize: authTypography.caption,
    fontWeight: '900',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: authTypography.hero,
    fontWeight: '900',
    marginTop: authSpacing.sm,
  },
  subtitle: {
    color: authColors.textSecondary,
    fontSize: authTypography.body,
    lineHeight: 23,
    marginTop: authSpacing.sm,
  },
  heroCard: {
    backgroundColor: 'rgba(13, 27, 19, 0.82)',
    borderColor: authColors.borderGold,
    borderRadius: authRadius.xl,
    borderWidth: 1,
    gap: authSpacing.md,
    marginTop: authSpacing.xxl,
    padding: authSpacing.xl,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  heroTitle: {
    color: authColors.textPrimary,
    fontSize: authTypography.subtitle,
    fontWeight: '900',
  },
  heroCopy: {
    color: authColors.textSecondary,
    fontSize: authTypography.caption,
    lineHeight: 20,
  },
  playerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.sm,
  },
  playerChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(107, 163, 110, 0.12)',
    borderColor: 'rgba(107, 163, 110, 0.28)',
    borderRadius: authRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: authSpacing.xs,
    paddingHorizontal: authSpacing.md,
    paddingVertical: authSpacing.sm,
  },
  playerText: {
    color: authColors.textPrimary,
    fontSize: authTypography.caption,
    fontWeight: '800',
  },
  addChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderRadius: authRadius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpacing.md,
  },
  typeCard: {
    backgroundColor: 'rgba(13, 27, 19, 0.76)',
    borderColor: authColors.borderSoft,
    borderRadius: authRadius.lg,
    borderWidth: 1,
    minWidth: '47%',
    padding: authSpacing.lg,
  },
  typeCardActive: {
    borderColor: authColors.gold,
  },
  typeText: {
    color: authColors.textSecondary,
    fontSize: authTypography.body,
    fontWeight: '800',
  },
  typeTextActive: {
    color: authColors.goldHighlight,
  },
});
