import React, { createContext, useState, useContext } from 'react';
import { translations } from '../constants/Translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [locale, setLocale] = useState('fr');
  const t = (key) => translations[locale][key] || key;

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);