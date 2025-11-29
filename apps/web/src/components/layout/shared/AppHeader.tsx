"use client";

import SignOutButton from "@/components/auth/SignOutButton";

type Props = {
  title?: string;
  right?: React.ReactNode;
  showLogout?: boolean;
  showYear?: boolean;
};

export default function AppHeader({ title, right, showLogout = true, showYear = false }: Props) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
      {showYear ? (
        <h2 className="text-sm font-semibold text-slate-500">
          Ano Letivo: <span className="text-slate-900 font-bold">2024/2025</span>
        </h2>
      ) : (
        <div className="font-semibold text-slate-900">{title ?? "Moxi Nexa"}</div>
      )}
      
      <div className="flex items-center gap-4">
        {right}
        {showLogout && (
          <SignOutButton 
            className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full" 
            redirectTo="/login" 
          />
        )}
      </div>
    </header>
  );
}