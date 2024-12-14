import { useCallback, useContext } from "react";
import { AppStateContext } from "../state/AppProvider";
import { de } from "../translations/de";
import { en } from "../translations/en";

// Function to map languages to their respective translation objects
const translations: { [key: string]: { [key: string]: string } } = {
  en,
  de,
};

// Translation function
export function t(key: string): string {
  // Return translation if exists, otherwise return key
  const appStateContext = useContext(AppStateContext)

  if (!appStateContext) {
    console.warn('AppStateContext is undefined. Falling back to default language.');
    return translations['en'][key] || key;
  }
  
  const ui = appStateContext?.state.frontendSettings?.ui
  let lang = ui?.language ?? 'en'
  return translations[lang]?.[key] || key;
}

export function useTranslation() {
  const appStateContext = useContext(AppStateContext);
  
  const translate = useCallback((key: string): string => {
    const lang = appStateContext?.state.frontendSettings?.ui?.language ?? 'en';
    return translations[lang]?.[key] || key;
  }, [appStateContext?.state.frontendSettings?.ui?.language]);

  return translate;
}