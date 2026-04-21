import BrandPanel from "./BrandPanel";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Login • Klasse",
  description: "Acesse sua conta Klasse.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-white">
      <BrandPanel />
      <div className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[420px]">
          <LoginForm />
          <p className="mt-10 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} Klasse. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}