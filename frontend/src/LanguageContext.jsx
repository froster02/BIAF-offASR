import { createContext, useContext, useState } from 'react';
import translations from './lang/translations';

const LangContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('baif_lang') || 'en';
  });

  const setLang = (code) => {
    setLangState(code);
    localStorage.setItem('baif_lang', code);
  };

  const t = (key) => {
    return translations[lang]?.[key] ?? translations.en?.[key] ?? key;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
