import type { Metadata } from "next";
import BrandPanel from "./BrandPanel";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Login • Klasse",
  description: "Acesse sua conta Klasse.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2">
      <BrandPanel />
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
