import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDefaultFormacaoPath, getFormacaoAuthContext } from "@/lib/auth-context";
import { supabaseServer } from "@/lib/supabaseServer";
import PortalNavLink from "./_components/PortalNavLink";
import { 
  getAuthorizedNavigation, 
  getNavigationConfigForTenant,
  mapTenantTypeFromDb,
  mapUserRoleFromDb,
} from "@/lib/navigation-engine";
import { 
  LayoutDashboard, 
  Inbox, 
  Users, 
  GraduationCap, 
  BadgeDollarSign, 
  Building2,
  Rocket,
  Calendar,
  ClipboardCheck,
  CreditCard,
  Wallet,
  Mail,
  Globe2,
  Home,
  UserPlus,
  FileText
} from "lucide-react";
import LockScreenButton from "@/components/session/LockScreenButton";

export const dynamic = "force-dynamic";

type SubscriptionInfo = {
  status: string;
  plano: string | null;
  trial_ends_at: string | null;
  days_left: number | null;
  is_expired: boolean;
};

async function getSubscriptionInfo(escolaId: string | null | undefined): Promise<SubscriptionInfo | null> {
  if (!escolaId) return null;
  const supabase = await supabaseServer();
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: "formacao_get_subscription_info",
      args: { p_escola_id: string }
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("formacao_get_subscription_info", { p_escola_id: escolaId });

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    status: String(row.status ?? "trial"),
    plano: typeof row.plano === "string" ? row.plano : null,
    trial_ends_at: typeof row.trial_ends_at === "string" ? row.trial_ends_at : null,
    days_left: typeof row.days_left === "number" ? row.days_left : null,
    is_expired: Boolean(row.is_expired),
  };
}

function NavIcon({ name }: { name: string }) {
  const className = "h-4 w-4 shrink-0";
  const icons: Record<string, any> = {
    LayoutDashboard: <LayoutDashboard className={className} />,
    Inbox: <Inbox className={className} />,
    Users: <Users className={className} />,
    GraduationCap: <GraduationCap className={className} />,
    BadgeDollarSign: <BadgeDollarSign className={className} />,
    Building2: <Building2 className={className} />,
    ClipboardCheck: <ClipboardCheck className={className} />,
    Rocket: <Rocket className={className} />,
    CreditCard: <CreditCard className={className} />,
    Calendar: <Calendar className={className} />,
    Wallet: <Wallet className={className} />,
    Globe2: <Globe2 className={className} />,
    UserPlus: <UserPlus className={className} />,
    FileText: <FileText className={className} />,
  };
  return icons[name] || <Home className={className} />;
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");
  const requestHeaders = await headers();

  const tenantFromDB = String(auth.tenantType ?? "");
  const userRoleFromDB = String(auth.role ?? "");
  const type = mapTenantTypeFromDb(tenantFromDB);
  const role = mapUserRoleFromDb(userRoleFromDB);
  const defaultPath = getDefaultFormacaoPath(auth.role, auth.tenantType);
  const route =
    requestHeaders.get("x-klasse-route") ??
    requestHeaders.get("x-pathname") ??
    requestHeaders.get("next-url") ??
    "/(portal)";

  console.info(
    JSON.stringify({
      event: "context_mapping",
      tenant_from_db: tenantFromDB.toLowerCase() || null,
      mapped_type: type,
      role: userRoleFromDB.toLowerCase() || null,
      route,
      timestamp: new Date().toISOString(),
    })
  );

  if (tenantFromDB.toLowerCase() === "formacao" && type === "SOLO_CREATOR") {
    console.error(
      JSON.stringify({
        event: "context_mapping_alert",
        severity: "critical",
        reason: "tenant_mapping_mismatch",
        tenant_from_db: tenantFromDB.toLowerCase(),
        mapped_type: type,
        role: userRoleFromDB.toLowerCase() || null,
        route,
        timestamp: new Date().toISOString(),
      })
    );
  }
  
  const tenantNavConfig = getNavigationConfigForTenant(type);
  const authorizedNav = getAuthorizedNavigation(tenantNavConfig, type, role);

  const groupedNav = ["Gestão", "Académico", "Financeiro", "Suporte"]
    .map((group) => ({
      label: group,
      items: authorizedNav.filter((item) => item.group === group),
    }))
    .filter((group) => group.items.length > 0);

  const tenantName = auth.tenantName ?? "Centro de Formação";
  const userName = auth.displayName ?? "Conta";
  const statusText = auth.tenantName ? "Activo" : "Em configuração";
  const statusClasses = auth.tenantName ? "text-emerald-600" : "text-amber-600";
  const subscription = await getSubscriptionInfo(auth.tenantId);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="hidden h-screen sticky top-0 z-40 border-r border-slate-800/80 bg-slate-950 text-slate-100 md:flex md:w-64 md:flex-col">
          <div className="flex items-center gap-3 border-b border-slate-800/80 px-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-klasse-gold/15 ring-1 ring-klasse-gold/30">
              <Image src="/logo-klasse-ui.png" alt="KLASSE" width={22} height={22} className="h-5 w-5 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="m-0 font-semibold tracking-tight leading-5">KLASSE</p>
              <p className="m-0 text-xs font-medium text-slate-400">gestão escolar</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3">
            <div className="space-y-3">
              {groupedNav.map((group) => (
                <div key={group.label} className="space-y-1">
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
                  {group.items.map((item) => (
                    <PortalNavLink key={item.id} href={item.href} label={item.label} icon={<NavIcon name={item.icon} />} />
                  ))}
                </div>
              ))}
            </div>
          </nav>

          <div className="mt-auto border-t border-slate-800/80 p-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-[10px] font-black text-slate-400">
                {type.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-bold text-slate-200">{tenantName}</p>
                <p className="m-0 truncate text-[10px] font-black uppercase tracking-widest text-slate-500">portal {type.toLowerCase()}</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
            <div className="flex h-16 items-center gap-4 px-4">
              <div className="hidden lg:flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-slate-900">Painel Operacional</span>
                <span className="text-xs text-slate-500 truncate">
                  {type} <span className={`ml-2 font-semibold ${statusClasses}`}>● {statusText}</span>
                </span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <LockScreenButton
                  iconOnly
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                />
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-10">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-klasse-green/15 ring-1 ring-klasse-green/25 text-xs font-semibold text-slate-700">
                      {userName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden text-sm font-medium text-slate-900 sm:inline">{userName}</span>
                  </summary>
                  <div className="absolute right-0 top-11 z-40 w-44 rounded-xl border border-zinc-200 bg-white p-2 text-zinc-900 shadow-lg">
                    <Link href={defaultPath} className="block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-zinc-100">Perfil</Link>
                    <Link href="/logout" className="block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-zinc-100">Sair</Link>
                  </div>
                </details>
              </div>
            </div>
          </header>

          {subscription?.status === "trial" || subscription?.is_expired ? (
            <TrialCountdownBanner subscription={subscription} />
          ) : null}

          <section className="p-4 md:p-6">{children}</section>
        </div>
      </div>
    </main>
  );
}

function TrialCountdownBanner({ subscription }: { subscription: SubscriptionInfo }) {
  const supportHref =
    process.env.KLASSE_FORMACAO_SUPPORT_WHATSAPP_URL?.trim() ||
    process.env.NEXT_PUBLIC_KLASSE_FORMACAO_SUPPORT_WHATSAPP_URL?.trim() ||
    "https://wa.me/244933349106";
  const daysLeft = subscription.days_left ?? 0;
  const message = subscription.is_expired
    ? "O período de teste terminou. Regularize a subscrição para voltar a operar o centro."
    : daysLeft <= 0
      ? "O seu período de teste termina hoje. Não perca o acesso aos seus dados."
      : `Faltam ${daysLeft} dia${daysLeft === 1 ? "" : "s"} para o seu período de teste terminar. Não perca o acesso aos seus dados.`;

  return (
    <div className={`border-b px-4 py-3 ${subscription.is_expired ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm font-semibold ${subscription.is_expired ? "text-rose-800" : "text-amber-900"}`}>{message}</p>
        <a
          href={supportHref}
          target="_blank"
          rel="noreferrer"
          className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${subscription.is_expired ? "bg-rose-700 hover:bg-rose-800" : "bg-amber-700 hover:bg-amber-800"}`}
        >
          Contactar Suporte
        </a>
      </div>
    </div>
  );
}
