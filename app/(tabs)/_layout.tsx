import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';

export default function TabLayout() {
  const { colors, dark } = useTheme();

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.background,
        borderTopColor: dark ? '#333' : '#EEE',
      },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.subText,
    }}>
      <Tabs.Screen
        name="index" // Ton Login
        options={{
          title: 'Connexion',
          tabBarIcon: ({ color }) => <Ionicons name="log-in-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="home" // Ta Carte
        options={{
          title: 'Carte',
          tabBarIcon: ({ color }) => <Ionicons name="map-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}