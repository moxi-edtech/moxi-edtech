import type { Metadata } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/system/ServiceWorkerRegister";
import { OfflineSyncRegister } from "@/components/system/OfflineSyncRegister";
import { ToastProvider } from "@/components/feedback/FeedbackSystem";

const shouldLoadGoogleFonts = process.env.NEXT_FONT_GOOGLE_FONTS_DISABLE !== "1";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/logo-klasse.png" type="image/png" />
        <meta name="theme-color" content="#1F6B3B" />
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
