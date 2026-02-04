import "server-only";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type FechoItem = {
  id: string;
  hora: string;
  aluno: string;
  valor: number;
  metodo: string;
  descricao: string;
};

type FechoTotals = {
  especie: number;
  tpa: number;
  transferencia: number;
  mcx: number;
  total: number;
};

type FechoResponse = {
  ok: true;
  date: string;
  operador_id: string | null;
  operador_label: string;
  escola_nome: string;
  totals: FechoTotals;
  items: FechoItem[];
};

function normalizeDate(dateParam?: string | null) {
  if (dateParam && DATE_RE.test(dateParam)) return dateParam;
  return new Date().toISOString().slice(0, 10);
}

function mapMetodo(metodo: string | null) {
  const normalized = (metodo || "").toLowerCase();
  if (normalized === "cash") return "especie";
  if (normalized === "tpa") return "tpa";
  if (normalized === "transfer") return "transferencia";
  if (normalized === "mcx") return "mcx";
  if (normalized === "kwik") return "mcx";
  return "outros";
}

export async function getFechoCaixaData({
  date,
  operadorId,
  operadorScope = "self",
}: {
  date?: string | null;
  operadorId?: string | null;
  operadorScope?: "self" | "all";
}): Promise<FechoResponse | { ok: false; error: string }> {
  const supabase = await supabaseServerTyped();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return { ok: false, error: "Não autenticado" };
  }

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
  if (!escolaId) {
    return { ok: false, error: "Escola não encontrada" };
  }

  const { data: vinc } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", escolaId)
    .eq("user_id", user.id)
    .maybeSingle();

  const papel = String((vinc as any)?.papel ?? "").toLowerCase();
  const allowedRoles = ["secretaria", "financeiro", "admin", "admin_escola", "staff_admin"];
  if (!allowedRoles.includes(papel)) {
    return { ok: false, error: "Sem permissão" };
  }

  const dateStr = normalizeDate(date);

  let operadorFilter: string | null = null;
  if (papel === "secretaria") {
    if (operadorScope !== "all") operadorFilter = user.id;
  } else if (operadorId) {
    operadorFilter = operadorId;
  }

  let pagamentosQuery = supabase
    .from("pagamentos")
    .select("id, aluno_id, valor_pago, metodo, created_at, status, created_by")
    .eq("escola_id", escolaId)
    .eq("day_key", dateStr)
    .eq("status", "settled")
    .order("created_at", { ascending: true });

  if (operadorFilter) {
    pagamentosQuery = pagamentosQuery.eq("created_by", operadorFilter);
  }

  const { data: rows, error } = await pagamentosQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  const alunoIds = Array.from(new Set((rows || []).map((row: any) => row.aluno_id).filter(Boolean)));
  const alunoMap = new Map<string, string>();
  if (alunoIds.length > 0) {
    const { data: alunos } = await supabase
      .from("alunos")
      .select("id, nome, nome_completo")
      .eq("escola_id", escolaId)
      .in("id", alunoIds);
    (alunos ?? []).forEach((aluno: any) => {
      alunoMap.set(aluno.id, aluno.nome_completo || aluno.nome || "—");
    });
  }

  const totals: FechoTotals = { especie: 0, tpa: 0, transferencia: 0, mcx: 0, total: 0 };
  const items: FechoItem[] = (rows || []).map((row: any) => {
    const metodo = mapMetodo(row.metodo);
    const valor = Number(row.valor_pago ?? 0);
    totals.total += valor;
    if (metodo === "especie") totals.especie += valor;
    if (metodo === "tpa") totals.tpa += valor;
    if (metodo === "transferencia") totals.transferencia += valor;
    if (metodo === "mcx") totals.mcx += valor;

    const alunoNome = row.aluno_id ? alunoMap.get(row.aluno_id) ?? "—" : "—";
    const hora = row.created_at
      ? new Date(row.created_at).toLocaleTimeString("pt-PT", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    return {
      id: row.id,
      hora,
      aluno: alunoNome,
      valor,
      metodo,
      descricao: "Pagamento",
    };
  });

  const operadorLabel = operadorFilter
    ? operadorFilter === user.id
      ? (user.user_metadata?.nome || user.email || "Operador")
      : "Operador"
    : "Todos";

  const { data: escola } = await supabase
    .from("escolas")
    .select("nome")
    .eq("id", escolaId)
    .maybeSingle();

  return {
    ok: true,
    date: dateStr,
    operador_id: operadorFilter,
    operador_label: operadorLabel,
    escola_nome: escola?.nome ?? "Escola",
    totals,
    items,
  };
}
