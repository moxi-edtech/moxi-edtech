"use client";

import SignOutButton from "@/components/auth/SignOutButton";

type Props = {
  title?: string;
  right?: React.ReactNode;  // botões extras
  showLogout?: boolean;
};

export default function AppHeader({ title, right, showLogout = true }: Props) {
  return (
    <header className="h-16 px-6 flex items-center justify-between border-b bg-white">
      <div className="font-semibold">{title ?? "Moxi Nexa"}</div>
      <div className="flex items-center gap-2">
        {right}
        {showLogout && (
          <SignOutButton className="text-slate-600 hover:text-slate-900" redirectTo="/login" />
        )}
      </div>
    </header>
  );
}

