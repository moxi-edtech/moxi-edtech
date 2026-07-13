import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/system/ServiceWorkerRegister";
import { OfflineSyncRegister } from "@/components/system/OfflineSyncRegister";
import { FeedbackProvider } from "@/components/feedback/FeedbackSystem";
import SessionLockProvider from "@/components/session/SessionLockProvider";
import { UserRoleProvider } from "@/components/auth/UserRoleProvider";
import SWRProvider from "@/components/providers/SWRProvider";

const shouldLoadGoogleFonts = process.env.NEXT_FONT_GOOGLE_FONTS_DISABLE !== "1";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1F6B3B",
};

export const metadata: Metadata = {
  manifest: "/manifest.json",
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
    <html lang="pt" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
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
        <FeedbackProvider>
          <SWRProvider>
            <UserRoleProvider>
              <SessionLockProvider>{children}</SessionLockProvider>
            </UserRoleProvider>
          </SWRProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
