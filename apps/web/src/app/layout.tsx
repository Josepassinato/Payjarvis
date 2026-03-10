import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { I18nProvider } from "@/components/i18n-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayJarvis — Bot Payment Identity",
  description: "Trust and identity layer for payment bots",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className="bg-surface text-gray-100 antialiased">
          <I18nProvider>
            {children}
          </I18nProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
