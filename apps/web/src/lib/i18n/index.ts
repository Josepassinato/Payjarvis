import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import es from "@/locales/es.json";

const STORAGE_KEY = "payjarvis-lang";

function getSavedLanguage(): string {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(STORAGE_KEY) ?? "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pt: { translation: pt },
    es: { translation: es },
  },
  lng: getSavedLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function changeLanguage(lang: string) {
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }
}

export default i18n;
