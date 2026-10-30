import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { isLoaded } from 'expo-font';
import {
  BarChart3,
  House,
  type LucideProps,
  User,
  Users,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DashboardScreen } from '../screens/app/DashboardScreen';
import { GameLobbyScreen } from '../screens/app/GameLobbyScreen';
import { ProfileScreen } from '../screens/app/ProfileScreen';
import { StatisticsScreen } from '../screens/app/StatisticsScreen';
import { authColors } from '../theme/colors';
import { authSpacing } from '../theme/spacing';
import { authFontFamilies, authTypography } from '../theme/typography';
import type { AppTabParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();

type TabIconProps = {
  focused: boolean;
  color: string;
  icon: ComponentType<LucideProps>;
};

function AnimatedTabIcon({ focused, color, icon: Icon }: TabIconProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(focused ? 1.14 : 1, {
          damping: 15,
          stiffness: 240,
        }),
      },
    ],
  }));

  return (
    <Animated.View
      style={[styles.iconWrap, focused && styles.iconActive, animatedStyle]}
    >
      <Icon color={color} size={21} strokeWidth={focused ? 2.6 : 2} />
    </Animated.View>
  );
}

export function AppTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: authColors.goldHighlight,
        tabBarInactiveTintColor: authColors.textSecondary,
        tabBarLabelStyle: [
          styles.label,
          isLoaded(authFontFamilies[500])
            ? { fontFamily: authFontFamilies[500], fontWeight: 'normal' }
            : undefined,
        ],
        tabBarStyle: [
          styles.tabBar,
          {
            height: 80 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, authSpacing.sm),
          },
        ],
        tabBarBackground: () => (
          <BlurView intensity={28} tint="dark" style={styles.blur} />
        ),
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon focused={focused} color={color} icon={House} />
          ),
        }}
      />
      <Tab.Screen
        name="Statistics"
        component={StatisticsScreen}
        options={{
          title: 'Statistik',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon focused={focused} color={color} icon={BarChart3} />
          ),
        }}
      />
      <Tab.Screen
        name="GameLobby"
        component={GameLobbyScreen}
        options={{
          title: 'Tische',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon focused={focused} color={color} icon={Users} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon focused={focused} color={color} icon={User} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: authColors.backgroundSoft,
    borderTopColor: authColors.borderSoft,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: authSpacing.sm,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  blur: {
    ...StyleSheet.absoluteFill,
  },
  label: {
    fontSize: authTypography.control,
    fontWeight: '500',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: authSpacing.sm,
    height: 30,
    justifyContent: 'center',
    width: 42,
  },
  iconActive: {
    backgroundColor: authColors.transparent,
  },
});
