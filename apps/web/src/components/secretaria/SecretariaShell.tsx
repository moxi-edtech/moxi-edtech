"use client";

import SecretariaSidebar from "./SecretariaSidebar";
import SecretariaTopbar from "./SecretariaTopbar";

export default function SecretariaShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen font-sans bg-gradient-to-br from-moxinexa-light/20 to-white text-moxinexa-dark">
      <SecretariaSidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <SecretariaTopbar />
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-moxinexa-light/30">
          {children}
        </div>
        <footer className="mt-8 text-center text-sm text-moxinexa-gray">
          <p>MoxiNexa - Secretaria</p>
        </footer>
      </main>
    </div>
  );
}

