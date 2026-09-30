import type { AiWidgetContext } from "./screen-context";

/**
 * Deriva o contexto que o widget de IA recebe a partir do pathname.
 *
 * Estava dentro de um `useMemo` no AppShell e por isso não tinha teste nenhum,
 * apesar de decidir o contexto de TODAS as páginas. Extraído para aqui para
 * poder ser exercido diretamente — ver tests/unit/assistant-widget-context.spec.ts.
 *
 * A ordem das regras é significativa: a primeira que casa vence, e as regras são
 * prefixos cada vez mais largos. `/configuracoes/estrutura` tem de vir primeiro
 * porque tanto `/admin/configuracoes/estrutura` como
 * `/operacoes/configuracoes/estrutura` casariam nos ramos `/admin` e `/operacoes`
 * mais abaixo.
 */
export function deriveWidgetContext(pathname: string): AiWidgetContext {
  // A Oferta Formativa vive fisicamente em admin/ e é re-exportada em operacoes/.
  // Sem esta regra caía em `dashboard` — o assistente pensava estar no dashboard
  // enquanto o utilizador olhava para os cursos e níveis de ensino.
  if (pathname.includes("/configuracoes/estrutura")) {
    return { module: "academico", page: "estrutura", entityType: "none" };
  }

  if (pathname.includes("/admin/comunicacao/whatsapp")) {
    return { module: "whatsapp", page: "central_whatsapp", entityType: "none" };
  }
  if (pathname.includes("/admin/avisos") || pathname.includes("/comunicacao")) {
    return { module: "comunicacao", page: "comunicados", entityType: "notice" };
  }
  if (pathname.includes("/financeiro")) {
    return {
      module: "financeiro",
      page: pathname.includes("/radar") ? "radar" : "financeiro",
      entityType: pathname.includes("/radar") ? "invoice" : "none",
    };
  }
  if (pathname.includes("/secretaria")) {
    return {
      module: "secretaria",
      page: pathname.includes("/alunos") ? "alunos" : "secretaria",
      entityType: pathname.includes("/alunos") ? "student" : "none",
    };
  }
  if (pathname.includes("/operacoes")) {
    return { module: "operacoes", page: "operacoes", entityType: "none" };
  }
  if (pathname.includes("/admin/ai")) {
    return { module: "classe_ai", page: "actions" };
  }
  if (pathname.includes("/admin")) {
    return { module: "dashboard", page: "admin" };
  }
  return { module: "dashboard" };
}
