import type { Metadata } from "next";
import "./globals.css";
import { PatientHeader } from "@/components/sections/patient-header";
import { PatientFooter } from "@/components/sections/patient-footer";
import { LanguageProvider } from "@/contexts/LanguageContext";

export const metadata: Metadata = {
  title: "MediRoute AI - Emergency Health Assistant",
  description: "AI-powered emergency triage and hospital routing. Get instant health guidance in Hindi or English.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LanguageProvider>
          <PatientHeader />
          {children}
          <PatientFooter />
        </LanguageProvider>
      </body>
    </html>
  );
}
