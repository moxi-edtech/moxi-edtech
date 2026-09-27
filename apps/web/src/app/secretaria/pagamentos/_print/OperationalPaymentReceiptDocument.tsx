import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { ReciboPagamentoDuasVias } from "@/components/financeiro/ReciboPagamentoCompacto";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { formatTurmaDisplayName } from "@/utils/formatters";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatPaymentMethod(value: unknown) {
  const method = String(value ?? "").toLowerCase();
  const labels: Record<string, string> = {
    cash: "Numerário",
    tpa: "TPA",
    transfer: "Transferência",
    mcx: "Multicaixa Express",
    kwik: "KWIK",
    kiwk: "KWIK",
  };
  return labels[method] ?? (method ? method.toUpperCase() : "—");
}

function formatMonth(value: unknown) {
  const month = Number(value);
  const labels = [
    "jan.",
    "fev.",
    "mar.",
    "abr.",
    "mai.",
    "jun.",
    "jul.",
    "ago.",
    "set.",
    "out.",
    "nov.",
    "dez.",
  ];
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? labels[month - 1]
    : String(value ?? "").trim();
}

function resolveReceiptType(meta: Record<string, unknown>): "pagamento" | "matricula" | "confirmacao" {
  const raw = `${meta.tipo_comprovativo ?? ""} ${meta.tipo_operacao ?? ""} ${meta.origem ?? ""}`.toLowerCase();
  if (raw.includes("confirm") || raw.includes("rematric")) return "confirmacao";
  if (raw.includes("matric")) return "matricula";
  return "pagamento";
}

export async function OperationalPaymentReceiptDocument({
  paymentId,
  requestedEscolaId = null,
}: {
  paymentId: string;
  requestedEscolaId?: string | null;
}) {
  const supabase = await supabaseServerTyped<any>();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="p-8">Utilizador não autenticado.</div>;
  }

  const escolaId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    requestedEscolaId
  );

  if (!escolaId || (requestedEscolaId && escolaId !== requestedEscolaId)) {
    return <div className="p-8">Sem acesso à escola deste pagamento.</div>;
  }

  const { data: payment, error: paymentError } = await supabase
    .from("pagamentos")
    .select(
      "id,escola_id,aluno_id,mensalidade_id,valor_pago,status,metodo,reference,referencia,data_pagamento,settled_at,created_at,meta"
    )
    .eq("id", paymentId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (paymentError || !payment) {
    return <div className="p-8">Pagamento não encontrado.</div>;
  }

  if (!["settled", "concluido", "pago"].includes(String(payment.status))) {
    return <div className="p-8">Pagamento ainda não liquidado.</div>;
  }

  const [{ data: escola }, { data: aluno }, { data: mensalidade }, { data: matricula }] =
    await Promise.all([
      supabase
        .from("escolas")
        .select("nome,logo_url,dados_pagamento")
        .eq("id", escolaId)
        .maybeSingle(),
      payment.aluno_id
        ? supabase
            .from("alunos")
            .select("nome,nome_completo,bi_numero")
            .eq("id", payment.aluno_id)
            .eq("escola_id", escolaId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      payment.mensalidade_id
        ? supabase
            .from("mensalidades")
            .select("id,mes_referencia,ano_referencia,valor,valor_previsto")
            .eq("id", payment.mensalidade_id)
            .eq("escola_id", escolaId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      payment.aluno_id
        ? supabase
            .from("matriculas")
            .select("turmas(nome,classes(nome),cursos(nome))")
            .eq("aluno_id", payment.aluno_id)
            .eq("escola_id", escolaId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const valorPago = Number(payment.valor_pago ?? 0);
  const meta = asRecord(payment.meta);
  const rawItems = Array.isArray(meta.itens_pagamento)
    ? meta.itens_pagamento
    : Array.isArray(meta.itens)
      ? meta.itens
      : [];

  let itensDetalhados: Array<{
    referencia: string;
    valor: number;
    quantidade?: number;
    valorUnitario?: number;
  }> = [];

  if (mensalidade) {
    const mes = formatMonth(mensalidade.mes_referencia);
    const ano = String(mensalidade.ano_referencia ?? "").trim();
    const label = [mes, ano].filter(Boolean).join("/");
    itensDetalhados = [
      {
        referencia: label ? `Mensalidade ${label}` : "Mensalidade",
        valor: valorPago,
        quantidade: 1,
        valorUnitario: valorPago,
      },
    ];
  } else {
    itensDetalhados = rawItems
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => {
        const row = item as Record<string, unknown>;
        const quantidade = Number(row.quantidade ?? row.qtd ?? 1);
        const unit = Number(row.preco ?? row.valor_unitario ?? row.valorUnitario ?? row.valor ?? 0);
        const explicitTotal = Number(row.valor ?? row.amount ?? NaN);
        const total = Number.isFinite(explicitTotal)
          ? explicitTotal
          : Number.isFinite(unit) && Number.isFinite(quantidade)
            ? unit * quantidade
            : 0;
        return {
          referencia: String(
            row.nome ?? row.descricao ?? row.referencia ?? row.label ?? "Item pago"
          ).trim(),
          valor: total,
          quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1,
          valorUnitario: Number.isFinite(unit) ? unit : total,
        };
      })
      .filter(
        (item) =>
          item.referencia.length > 0 &&
          Number.isFinite(item.valor) &&
          item.valor >= 0
      );

    const itemsTotal = itensDetalhados.reduce((sum, item) => sum + item.valor, 0);
    if (
      itensDetalhados.length === 0 ||
      Math.abs(itemsTotal - valorPago) > 0.01
    ) {
      const description = String(
        meta.descricao_item ??
          payment.reference ??
          payment.referencia ??
          "Pagamento"
      ).trim();
      itensDetalhados = [
        {
          referencia: description || "Pagamento",
          valor: valorPago,
          quantidade: 1,
          valorUnitario: valorPago,
        },
      ];
    }
  }

  const referencia =
    itensDetalhados.map((item) => item.referencia).filter(Boolean).join(", ") ||
    "Pagamento";

  const turma = (matricula as any)?.turmas ?? null;
  const turmaNome = turma?.nome
    ? formatTurmaDisplayName({ turma_nome: turma.nome })
    : "—";
  const dadosPagamento = asRecord(escola?.dados_pagamento);
  const paymentDate = payment.data_pagamento ?? payment.settled_at ?? payment.created_at;
  const emittedAt = payment.settled_at ?? payment.created_at;
  const operationalNumber = `OP-${String(payment.id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  return (
    <div className={`min-h-screen ${styles.printRoot} text-slate-900`}>
      <PrintTrigger />
      <div className={`${styles.sheet} ${styles.receiptCompactSheet} shadow-lg`}>
        <ReciboPagamentoDuasVias
          escolaNome={escola?.nome ?? "Escola"}
          alunoNome={aluno?.nome_completo ?? aluno?.nome ?? "—"}
          alunoBi={aluno?.bi_numero ?? "—"}
          classeNome={turma?.classes?.nome ?? "—"}
          cursoNome={turma?.cursos?.nome ?? ""}
          turmaNome={turmaNome}
          referencia={referencia}
          tipoComprovativo={resolveReceiptType(meta)}
          itensDetalhados={itensDetalhados}
          metodo={formatPaymentMethod(payment.metodo)}
          valorPago={valorPago}
          dataPagamento={
            paymentDate ? new Date(String(paymentDate)).toLocaleDateString("pt-PT") : "—"
          }
          numero={operationalNumber}
          publicId={payment.id}
          urlValidacao={null}
          logoUrl={escola?.logo_url ?? null}
          emitidoEm={
            emittedAt ? new Date(String(emittedAt)).toLocaleString("pt-PT") : null
          }
          banco={typeof dadosPagamento.banco === "string" ? dadosPagamento.banco : null}
          titularConta={
            typeof dadosPagamento.titular_conta === "string"
              ? dadosPagamento.titular_conta
              : null
          }
          iban={typeof dadosPagamento.iban === "string" ? dadosPagamento.iban : null}
          kwikChave={
            typeof dadosPagamento.kwik_chave === "string"
              ? dadosPagamento.kwik_chave
              : null
          }
          operationalOnly
        />
      </div>
    </div>
  );
}
