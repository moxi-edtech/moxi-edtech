import clsx from "clsx";
import {
  HomeIcon,
  UsersIcon,
  AcademicCapIcon,
  BanknotesIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  LifebuoyIcon,
  BuildingLibraryIcon,
  BoltIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

const navigation = [
  { name: "Dashboard", icon: HomeIcon, href: "/super-admin" },
  { name: "Escolas", icon: BuildingLibraryIcon, href: "/super-admin/escolas" },
  { name: "Usuários Globais", icon: UsersIcon, href: "/super-admin/usuarios" },
  { name: "Financeiro", icon: BanknotesIcon, href: "/financeiro" },
  { name: "Relatórios", icon: ChartBarIcon, href: "/super-admin/relatorios" },
  { name: "Configurações", icon: Cog6ToothIcon, href: "/super-admin/configuracoes" },
  { name: "Suporte", icon: LifebuoyIcon, href: "/super-admin/suporte" },
];

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="px-6 py-5 flex items-center gap-3">
      <div className="bg-gradient-to-r from-teal-500 to-sky-600 text-white rounded-xl w-10 h-10 flex items-center justify-center shadow-lg">
        <span className="text-lg">🎓</span>
      </div>
      {!collapsed && (
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-moxinexa-light bg-clip-text text-transparent">
            MoxiNexa
          </h1>
          <p className="text-xs text-moxinexa-light/80">Super Admin</p>
        </div>
      )}
    </div>
  )
}

export default function SidebarServer({ collapsed }: { collapsed: boolean }) {
  const items = [...navigation]
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_SEED === "1") {
    items.push({ name: "Seed Super Admin", icon: BoltIcon, href: "/admin-seed" } as any)
  }
  if (process.env.NODE_ENV !== "production") {
    items.push({ name: "Debug", icon: BoltIcon, href: "/super-admin/debug" } as any)
    items.push({ name: "Debug Email", icon: EnvelopeIcon, href: "/super-admin/debug/email-preview" } as any)
  }

  return (
    <aside className={clsx(
      "relative bg-gradient-to-b from-teal-500/95 to-sky-600/95 text-white flex flex-col shadow-xl backdrop-blur-sm h-screen transition-all duration-200 ease-in-out",
      collapsed ? "w-16" : "w-72"
    )}>
      <Logo collapsed={collapsed} />
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => (
          <a
            key={item.name}
            href={item.href}
            className={clsx(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-white/80 hover:text-white hover:bg-white/10",
              collapsed && "justify-center"
            )}
            title={item.name}
          >
            <item.icon className={clsx("w-5 h-5", !collapsed && "mr-3")} />
            {!collapsed && <span>{item.name}</span>}
          </a>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        {!collapsed && (
          <div className="bg-white/5 p-3 rounded-xl mb-3">
            <h3 className="font-semibold text-sm text-white">Status do Sistema</h3>
            <div className="flex items-center mt-1">
              <div className="w-2 h-2 bg-teal-400 rounded-full mr-2"></div>
              <p className="text-xs text-moxinexa-light/80">Todos os sistemas operacionais</p>
            </div>
          </div>
        )}
        <div className={clsx(
          "flex justify-between items-center text-xs text-moxinexa-light/70",
          collapsed && "justify-center"
        )}>
          {!collapsed && <span>v2.1.0 · Super Admin</span>}
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </aside>
  )
}

