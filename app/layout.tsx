import type { Metadata } from "next";
import { Orbitron, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  weight: ["400", "700", "900"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "AP01 La Soledad — PTAP Interactiva | UAESP Cali",
  description:
    "Aplicación interactiva de monitoreo de la Planta de Tratamiento de Agua Potable AP01 La Soledad, La Buitrera — UAESP Cali 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${orbitron.variable} ${ibmPlexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
