import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';

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
        name="home" // Ta Carte
        options={{
          title: 'Carte',
          tabBarIcon: ({ color }) => <Ionicons name="map-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}