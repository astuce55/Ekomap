import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import HomeScreenComponent from '../../src/screens/HomeScreen'; // Ton code de carte actuel

export default function HomeRoute() {
  const { role } = useLocalSearchParams();
  const router = useRouter();

  const handleReportSecurity = (openMenuCallback) => {
    if (role === 'guest') {
      Alert.alert(
        "Accès limité",
        "La communauté EkoMap a besoin de savoir qui signale. Connectez-vous pour aider les autres !",
        [
          { text: "Plus tard", style: "cancel" },
          { text: "Se connecter", onPress: () => router.replace('/') }
        ]
      );
    } else {
      openMenuCallback(); // Ouvre le menu de signalement
    }
  };

  return <HomeScreenComponent onReportPress={handleReportSecurity} />;
}