import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
export default function SegurancaConfiguracaoPage() {
  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-4`}>
      <h1 className="text-2xl font-semibold text-slate-900">Segurança & Avançado</h1>
      <p className="text-sm text-slate-600">
        Ajustes avançados de auditoria, acessos e governança acadêmica.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Em breve: regras avançadas, logs e políticas de acesso detalhadas.
      </div>
    </div>
  );
}
