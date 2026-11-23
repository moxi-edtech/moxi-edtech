import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
export default function SegurancaConfiguracaoPage() {
  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-4`}>
      <h1 className="text-2xl font-semibold text-foreground">Segurança & Avançado</h1>
      <p className="text-sm text-muted-foreground">
        Ajustes avançados de auditoria, acessos e governança acadêmica.
      </p>
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Em breve: regras avançadas, logs e políticas de acesso detalhadas.
      </div>
    </div>
  );
}
