// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoxiNexa - Sistema de Gestão Escolar",
  description: "Portal administrativo para gestão escolar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className="antialiased bg-moxinexa-light text-moxinexa-dark font-sans">
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
