import BrandPanel from "./BrandPanel";
import LoginForm from "./LoginForm";

type SearchParams = Promise<{ redirect?: string }>;

function normalizeReturnTo(raw: string | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return "";
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const redirectTo = normalizeReturnTo(params.redirect);

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      <BrandPanel />
      <main className="grid place-items-center bg-slate-50 p-6">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm redirectTo={redirectTo} />
        </section>
      </main>
    </div>
  );
}
