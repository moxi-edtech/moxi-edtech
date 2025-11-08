// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoxiNexa - Sistema de Gestão Escolar",
  description: "Portal administrativo para gestão escolar",
};

// As rotas usam cookies/sessão do Supabase. Força modo dinâmico
export const dynamic = 'force-dynamic';

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
        {/** Toasts are mounted per-page where needed to keep shared bundle small */}
      </body>
    </html>
  );
}
