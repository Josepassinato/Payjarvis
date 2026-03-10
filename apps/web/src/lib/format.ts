import i18n from "@/lib/i18n";

const localeMap: Record<string, string> = {
  en: "en-US",
  pt: "pt-BR",
  es: "es-ES",
};

function getLocale(): string {
  return localeMap[i18n.language] ?? "en-US";
}

export function currency(value: number, cur = "USD"): string {
  return new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency: cur,
  }).format(value);
}

export function shortDate(date: string | Date): string {
  return new Intl.DateTimeFormat(getLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
