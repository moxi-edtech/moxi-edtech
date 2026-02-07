import "./globals.css";
import "sonner/dist/styles.css";
import { Sora } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/system/ServiceWorkerRegister";
import { OfflineSyncRegister } from "@/components/system/OfflineSyncRegister";
import SonnerClient from "@/components/SonnerClient";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1F6B3B" />
      </head>
      <body className={`h-full ${sora.className}`}>
        <ServiceWorkerRegister />
        <OfflineSyncRegister />
        <SonnerClient />
        {children}
      </body>
    </html>
  );
}
