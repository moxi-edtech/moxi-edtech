import "server-only";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type FechoItem = {
  id: string;
  hora: string;
  aluno: string;
  valor: number;
  metodo: string;
};

type FechoTotals = {
  especie: number;
  tpa: number;
  transferencia: number;
  total: number;
};

type FechoResponse = {
  ok: boolean;
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

function dateRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function mapMetodo(metodo: string | null) {
  const normalized = (metodo || "").toLowerCase();
  if (normalized === "numerario" || normalized === "dinheiro") return "especie";
  if (normalized === "multicaixa" || normalized === "tpa" || normalized === "tpa_fisico") return "tpa";
  if (normalized === "transferencia" || normalized === "deposito") return "transferencia";
  return "outros";
}

export async function getFechoCaixaData({
  date,
  operadorId,
}: {
  date?: string | null;
  operadorId?: string | null;
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
  const range = dateRange(dateStr);

  let operadorFilter: string | null = null;
  if (papel === "secretaria") {
    operadorFilter = user.id;
  } else if (operadorId) {
    operadorFilter = operadorId;
  }

  let query = supabase
    .from("financeiro_lancamentos")
    .select(
      "id, valor_total, valor_original, data_pagamento, metodo_pagamento, created_by, alunos(nome, nome_completo)"
    )
    .eq("escola_id", escolaId)
    .eq("status", "pago")
    .not("data_pagamento", "is", null)
    .gte("data_pagamento", range.start)
    .lt("data_pagamento", range.end)
    .order("data_pagamento", { ascending: true })
    .order("created_at", { ascending: true });

  if (operadorFilter) {
    query = query.eq("created_by", operadorFilter);
  }

  query = applyKf2ListInvariants(query, { defaultLimit: 500 });

  const { data: rows, error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }

  const totals: FechoTotals = { especie: 0, tpa: 0, transferencia: 0, total: 0 };
  const items: FechoItem[] = (rows || []).map((row: any) => {
    const metodo = mapMetodo(row.metodo_pagamento);
    const valor = Number(row.valor_total ?? row.valor_original ?? 0);
    totals.total += valor;
    if (metodo === "especie") totals.especie += valor;
    if (metodo === "tpa") totals.tpa += valor;
    if (metodo === "transferencia") totals.transferencia += valor;

    const alunoRaw = row.alunos || {};
    const alunoNome = alunoRaw.nome_completo || alunoRaw.nome || "—";
    const hora = row.data_pagamento
      ? new Date(row.data_pagamento).toLocaleTimeString("pt-PT", {
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
