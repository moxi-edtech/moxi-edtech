import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();

    if (!userRes?.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedEscolaId = searchParams.get("escolaId") || searchParams.get("escola_id");
    const escolaId = await resolveEscolaIdForUser(supabase, userRes.user.id, requestedEscolaId);
    
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    const classeId = searchParams.get("classe_id");
    const turmaId = searchParams.get("turma_id");
    const mes = searchParams.get("mes"); // MM
    const ano = searchParams.get("ano"); // YYYY
    const status = searchParams.get("status") || "pendente"; // pendente, pago, etc. (para mensalidades)
    const source = searchParams.get("source") || "mensalidades"; // mensalidades | matriculas
    const type = searchParams.get("type"); // matricula | confirmacao | bolsista (para source=matriculas)

    if (source === "mensalidades") {
      if (!mes || !ano) {
        return NextResponse.json({ ok: false, error: "Mês e ano são obrigatórios para mensalidades" }, { status: 400 });
      }

      const query = supabase
        .from("mensalidades")
        .select(`
          id,
          valor,
          valor_pago_total,
          status,
          data_vencimento,
          aluno_id,
          alunos (
            id,
            nome,
            numero_processo,
            foto_url,
            encarregados (
              id,
              nome,
              telemovel,
              email
            )
          ),
          turmas (
            id,
            nome,
            classe_id
          )
        `)
        .eq("escola_id", escolaId)
        .eq("mes_referencia", parseInt(mes, 10))
        .eq("ano_referencia", parseInt(ano, 10))
        .eq("status", status)
        .not("turmas", "is", null);

      if (status === "pendente") {
        query.lt("data_vencimento", new Date().toISOString().split('T')[0]);
      }

      if (turmaId) {
        query.eq("turma_id", turmaId);
      } else if (classeId) {
        query.eq("turmas.classe_id", classeId);
      }

      const { data: items, error } = await query;
      if (error) throw error;

      const filtered = (items || []).filter((m: any) => {
        if (turmaId) return m.turmas?.id === turmaId;
        if (classeId) return m.turmas?.classe_id === classeId;
        return true;
      });

      const students = filtered.map((m: any) => ({
        id: m.id,
        alunoId: m.alunos?.id,
        nome: m.alunos?.nome,
        processo: m.alunos?.numero_processo,
        foto: m.alunos?.foto_url,
        valor: m.valor,
        pago: m.valor_pago_total,
        status: m.status,
        vencimento: m.data_vencimento,
        turma: m.turmas?.nome,
        encarregado: m.alunos?.encarregados?.nome,
        contacto: m.alunos?.encarregados?.telemovel,
        email: m.alunos?.encarregados?.email,
      }));

      return NextResponse.json({ ok: true, items: students });
    }

    if (source === "matriculas") {
      if ((!classeId && !turmaId) || !ano) {
        return NextResponse.json({ ok: false, error: "Parâmetros insuficientes para matrículas" }, { status: 400 });
      }

      const query = supabase
        .from("matriculas")
        .select(`
          id,
          status,
          created_at,
          aluno_id,
          origem_transicao_matricula_id,
          percentagem_desconto,
          motivo_desconto,
          alunos (
            id,
            nome,
            numero_processo,
            foto_url,
            encarregados (
              id,
              nome,
              telemovel,
              email
            )
          ),
          turmas (
            id,
            nome,
            classe_id
          )
        `)
        .eq("escola_id", escolaId)
        .eq("ano_letivo", parseInt(ano, 10))
        .not("turmas", "is", null);

      if (turmaId) {
        query.eq("turma_id", turmaId);
      } else if (classeId) {
        query.eq("turmas.classe_id", classeId);
      }

      if (type === "confirmacao") {
        query.not("origem_transicao_matricula_id", "is", null);
      } else if (type === "matricula") {
        query.is("origem_transicao_matricula_id", null);
      } else if (type === "bolsista") {
        // Filtro complexo de OR bolsista via percentagem ou motivo no cliente ou via RPC?
        // Vamos filtrar no JS para simplificar filtros de or complexos se necessário,
        // mas aqui podemos tentar um filtro básico.
      }

      const { data: items, error } = await query;
      if (error) throw error;

      let filtered = (items || []).filter((m: any) => {
        if (turmaId) return m.turmas?.id === turmaId;
        if (classeId) return m.turmas?.classe_id === classeId;
        return true;
      });

      if (type === "bolsista") {
        filtered = filtered.filter((m: any) => Number(m.percentagem_desconto) > 0 || !!m.motivo_desconto);
      }

      const students = filtered.map((m: any) => ({
        id: m.id,
        alunoId: m.alunos?.id,
        nome: m.alunos?.nome,
        processo: m.alunos?.numero_processo,
        foto: m.alunos?.foto_url,
        valor: 0,
        pago: 0,
        status: m.status,
        vencimento: m.created_at,
        turma: m.turmas?.nome,
        encarregado: m.alunos?.encarregados?.nome,
        contacto: m.alunos?.encarregados?.telemovel,
        email: m.alunos?.encarregados?.email,
      }));

      return NextResponse.json({ ok: true, items: students });
    }

    return NextResponse.json({ ok: false, error: "Fonte de dados inválida" }, { status: 400 });

  } catch (err: any) {
    console.error("[drill-down] fatal", err);
    return NextResponse.json({ ok: false, error: "Erro interno no drill-down" }, { status: 500 });
  }
}
