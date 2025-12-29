import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [dark, setDark] = useState(false);

  // Charger le thème au démarrage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('userTheme');
        if (savedTheme !== null) {
          setDark(JSON.parse(savedTheme));
        }
      } catch (e) { console.error("Erreur chargement thème", e); }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    try {
      const newTheme = !dark;
      setDark(newTheme);
      await AsyncStorage.setItem('userTheme', JSON.stringify(newTheme));
    } catch (e) { console.error("Erreur sauvegarde thème", e); }
  };

  const colors = {
    background: dark ? '#121212' : '#FFFFFF',
    text: dark ? '#FFFFFF' : '#333333',
    subText: dark ? '#AAAAAA' : '#666666',
    accent: '#00FF66', // Ton vert EkoMap
    card: dark ? '#1E1E1E' : '#F5F5F5',
  };

  return (
    <ThemeContext.Provider value={{ dark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);