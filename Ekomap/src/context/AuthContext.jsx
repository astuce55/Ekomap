import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      const guestMode = await AsyncStorage.getItem('guestMode');
      
      if (userData) {
        setUser(JSON.parse(userData));
        setIsGuest(false);
      } else if (guestMode === 'true') {
        setIsGuest(true);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      // TODO: Remplacer par un vrai appel API
      // Simulation pour le moment
      const mockUser = {
        id: '1',
        email: email,
        name: 'Utilisateur Test'
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(mockUser));
      await AsyncStorage.removeItem('guestMode');
      setUser(mockUser);
      setIsGuest(false);
    } catch (error) {
      throw new Error('Échec de la connexion');
    }
  };

  const register = async (name, email, password) => {
    try {
      // TODO: Remplacer par un vrai appel API
      const mockUser = {
        id: Date.now().toString(),
        email: email,
        name: name
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(mockUser));
      await AsyncStorage.removeItem('guestMode');
      setUser(mockUser);
      setIsGuest(false);
    } catch (error) {
      throw new Error('Échec de l\'inscription');
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['user', 'guestMode']);
    setUser(null);
    setIsGuest(false);
  };

  const continueAsGuest = async () => {
    await AsyncStorage.setItem('guestMode', 'true');
    await AsyncStorage.removeItem('user');
    setIsGuest(true);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isGuest, loading, login, register, logout, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider');
  }
  return context;
};