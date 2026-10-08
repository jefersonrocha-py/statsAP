import "../styles/globals.css";
import type { Metadata } from "next";
import ThemeScript from "@components/ThemeScript";
import ThemeSync from "@components/ThemeSync";

export const metadata: Metadata = {
  title: "Stats A.P",
  description: "Monitoramento dos APs Grandstream da Etheriumtech: mapa, status, clientes e ocorrências.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-app text-app antialiased">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
