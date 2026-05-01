import type { Metadata } from "next";
import "./globals.css";
import SessionLockProvider from "@/components/session/SessionLockProvider";

export const metadata: Metadata = {
  title: "KLASSE Formação",
  description: "Produto Formação da plataforma KLASSE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO">
      <body>
        <SessionLockProvider>{children}</SessionLockProvider>
      </body>
    </html>
  );
}
