import BrandPanel from "./BrandPanel";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Área de acesso KLASSE",
  description: "Página de login da KLASSE para clientes e equipas já ativas. Esta rota é secundária na aquisição e não compete com a homepage comercial.",
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
