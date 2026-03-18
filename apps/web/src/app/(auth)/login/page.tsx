import { headers } from "next/headers";
import { redirect } from "next/navigation";

import BrandPanel from "./BrandPanel";
import LoginForm from "./LoginForm";

const appSiteUrl = process.env.NEXT_PUBLIC_APP_SITE_URL ?? "https://app.klasse.ao";

export const metadata = {
  title: "Área de acesso KLASSE",
  description: "Página de login da KLASSE para clientes e equipas já ativas. Esta rota pertence ao domínio da aplicação e não compete com a homepage comercial.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  const host = (await headers()).get("host") ?? "";

  if (host && !host.startsWith("app.")) {
    redirect(`${appSiteUrl}/login`);
  }

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
