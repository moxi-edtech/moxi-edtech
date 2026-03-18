import type { Metadata } from "next";

import "./globals.css";
import { ToastProvider } from "@/components/feedback/FeedbackSystem";
import { OfflineSyncRegister } from "@/components/system/OfflineSyncRegister";
import { ServiceWorkerRegister } from "@/components/system/ServiceWorkerRegister";

const shouldLoadGoogleFonts = process.env.NEXT_FONT_GOOGLE_FONTS_DISABLE !== "1";
const marketingSiteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://klasse.ao";
const metadataBase = new URL(marketingSiteUrl);
const socialImage = {
  url: "/new.PNG",
  width: 1536,
  height: 1024,
  alt: "KLASSE — sistema de gestão escolar em Angola",
};

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "KLASSE — Sistema de gestão escolar em Angola para propinas, matrículas, notas e presenças",
    template: "%s | KLASSE",
  },
  description:
    "KLASSE é um software de gestão escolar em Angola para escolas que querem controlar propinas, matrículas, notas, presenças e operação académica numa única plataforma.",
  applicationName: "KLASSE",
  themeColor: "#1F6B3B",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-klasse.png",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "KLASSE",
    title: "KLASSE — Sistema de gestão escolar em Angola para propinas, matrículas, notas e presenças",
    description:
      "Software para escolas em Angola com gestão de propinas, matrículas, notas e presenças numa única plataforma.",
    images: [socialImage],
    locale: "pt_AO",
  },
  twitter: {
    card: "summary_large_image",
    title: "KLASSE — Sistema de gestão escolar em Angola para propinas, matrículas, notas e presenças",
    description:
      "Software para escolas em Angola com gestão de propinas, matrículas, notas e presenças numa única plataforma.",
    images: [socialImage.url],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className="h-full">
      <head>
        {shouldLoadGoogleFonts && (
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap"
          />
        )}
      </head>
      <body className="h-full" style={{ fontFamily: shouldLoadGoogleFonts ? "Sora, sans-serif" : "sans-serif" }}>
        <ServiceWorkerRegister />
        <OfflineSyncRegister />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
