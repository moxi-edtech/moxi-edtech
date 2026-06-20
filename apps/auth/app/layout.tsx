import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KLASSE Auth",
  description: "Login central do KLASSE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
