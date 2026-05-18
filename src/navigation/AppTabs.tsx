import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import {
  BarChart3,
  House,
  type LucideProps,
  Spade,
  User,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { DashboardScreen } from '../screens/app/DashboardScreen';
import { GameLobbyScreen } from '../screens/app/GameLobbyScreen';
import { ProfileScreen } from '../screens/app/ProfileScreen';
import { StatisticsScreen } from '../screens/app/StatisticsScreen';
import { authColors } from '../theme/colors';
import { authRadius } from '../theme/spacing';
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: authColors.goldHighlight,
        tabBarInactiveTintColor: 'rgba(139, 161, 148, 0.68)',
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
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
          title: 'Spielen',
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon focused={focused} color={color} icon={Spade} />
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
    backgroundColor: 'rgba(16, 36, 28, 0.82)',
    borderColor: 'rgba(231, 198, 92, 0.18)',
    borderRadius: authRadius.xl,
    borderTopWidth: 1,
    bottom: 22,
    elevation: 10,
    height: 74,
    left: 18,
    overflow: 'hidden',
    paddingBottom: 10,
    paddingTop: 8,
    position: 'absolute',
    right: 18,
    shadowColor: authColors.shadow,
    shadowOffset: { height: 16, width: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: authRadius.pill,
    height: 30,
    justifyContent: 'center',
    width: 42,
  },
  iconActive: {
    backgroundColor: 'rgba(231, 198, 92, 0.15)',
  },
});
