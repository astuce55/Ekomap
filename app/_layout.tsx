import { ThemeProvider } from './src/context/ThemeContext';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // <-- AJOUTER CECI

export default function RootLayout() {
  return (
    // GestureHandlerRootView doit être tout en haut, avec style flex: 1
    <GestureHandlerRootView style={{ flex: 1 }}> 
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}