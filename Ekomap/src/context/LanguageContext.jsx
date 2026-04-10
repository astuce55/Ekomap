import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../constants/Translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [locale, setLocaleState] = useState('fr'); // Français par défaut

  // Charger la langue sauvegardée au démarrage
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLocale = await AsyncStorage.getItem('userLanguage');
        if (savedLocale !== null) {
          console.log('✅ Langue chargée:', savedLocale);
          setLocaleState(savedLocale);
        } else {
          console.log('ℹ️ Aucune langue sauvegardée, utilisation du français par défaut');
        }
      } catch (e) {
        console.error("❌ Erreur chargement langue:", e);
      }
    };
    loadLanguage();
  }, []);

  // Fonction pour changer et sauvegarder la langue
  const setLocale = async (newLocale) => {
    try {
      console.log('🌍 Changement de langue vers:', newLocale);
      setLocaleState(newLocale);
      await AsyncStorage.setItem('userLanguage', newLocale);
      console.log('✅ Langue sauvegardée:', newLocale);
    } catch (e) {
      console.error("❌ Erreur sauvegarde langue:", e);
    }
  };

  // Fonction de traduction
  const t = (key) => {
    const translation = translations[locale]?.[key];
    if (!translation) {
      console.warn(`⚠️ Traduction manquante pour la clé "${key}" en ${locale}`);
      return key; // Retourner la clé si la traduction n'existe pas
    }
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage doit être utilisé dans LanguageProvider');
  }
  return context;
};