import type { Metadata } from "next";
import { Nunito_Sans, Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

// Tipografía primaria del manual de marca (sustituto de Avenir): titulares y logotipo
const brandSans = Nunito_Sans({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

// Tipografía secundaria del manual: cuerpo, informes y documentos
const bodySans = Roboto({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

// Variante monoespaciada de la familia Roboto para columnas numéricas
const bodyMono = Roboto_Mono({
  variable: "--font-numeric",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Emporium Quant Desk",
  description:
    "Tecnología propietaria de análisis y gobernanza financiera: agentes, estrategias y portafolios algorítmicos para preservar el capital y maximizar retornos ajustados al riesgo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${brandSans.variable} ${bodySans.variable} ${bodyMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">{children}</body>
    </html>
  );
}
