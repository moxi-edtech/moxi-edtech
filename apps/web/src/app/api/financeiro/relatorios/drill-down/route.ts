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
          turma_id,
          matricula_id,
          aluno_id,
          alunos (
            id,
            nome,
            numero_processo,
            foto_url,
            encarregado_nome,
            encarregado_telefone,
            encarregado_email
          )
        `)
        .eq("escola_id", escolaId)
        .eq("mes_referencia", parseInt(mes, 10))
        .eq("ano_referencia", parseInt(ano, 10))
        .eq("status", status);

      if (status === "pendente") {
        query.lt("data_vencimento", new Date().toISOString().split('T')[0]);
      }

      // Fetch all installments for the month
      const { data: rawItems, error } = await query;
      if (error) throw error;

      // Extract all necessary turma_ids (either direct or via matricula)
      const turmaIdsToFetch = new Set<string>();
      const matriculaIdsToFetch = new Set<string>();

      (rawItems || []).forEach((m: any) => {
        if (m.turma_id) turmaIdsToFetch.add(m.turma_id);
        else if (m.matricula_id) matriculaIdsToFetch.add(m.matricula_id);
      });

      // Resolve matricula_id to turma_id
      const matriculaTurmaMap: Record<string, string> = {};
      if (matriculaIdsToFetch.size > 0) {
        const { data: mats, error: matsError } = await supabase
          .from("matriculas")
          .select("id, turma_id")
          .in("id", Array.from(matriculaIdsToFetch))
          .not("turma_id", "is", null);
        
        if (matsError) throw new Error(`Error fetching matriculas: ${matsError.message}`);
        
        (mats || []).forEach(m => {
          if (m.turma_id) {
             matriculaTurmaMap[m.id] = m.turma_id;
             turmaIdsToFetch.add(m.turma_id);
          }
        });
      }

      // Fetch turma details (nome and classe_id)
      const turmasMap: Record<string, any> = {};
      if (turmaIdsToFetch.size > 0) {
         const { data: turmas, error: turmasError } = await supabase
          .from("turmas")
          .select("id, nome, classe_id")
          .in("id", Array.from(turmaIdsToFetch));
         
         if (turmasError) throw new Error(`Error fetching turmas: ${turmasError.message}`);

         (turmas || []).forEach(t => { turmasMap[t.id] = t; });
      }

      // Filter and map items
      const items = (rawItems || []).map((m: any) => {
        const resolvedTurmaId = m.turma_id || (m.matricula_id ? matriculaTurmaMap[m.matricula_id] : null);
        const turma = resolvedTurmaId ? turmasMap[resolvedTurmaId] : null;
        return { ...m, resolved_turma: turma };
      }).filter((m: any) => {
        if (!m.resolved_turma) return false;
        if (turmaId && m.resolved_turma.id !== turmaId) return false;
        if (classeId && m.resolved_turma.classe_id !== classeId) return false;
        return true;
      });

      const students = items.map((m: any) => {
        // Handle case where alunos might be an array (due to foreign key definitions sometimes returning arrays in Supabase JS if not strictly many-to-one)
        const aluno = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;

        return {
          id: m.id,
          alunoId: aluno?.id,
          nome: aluno?.nome || "Aluno Desconhecido",
          processo: aluno?.numero_processo || "N/A",
          foto: aluno?.foto_url,
          valor: m.valor,
          pago: m.valor_pago_total,
          status: m.status,
          vencimento: m.data_vencimento,
          turma: m.resolved_turma?.nome || "Sem Turma",
          encarregado: aluno?.encarregado_nome || "",
          contacto: aluno?.encarregado_telefone || "",
          email: aluno?.encarregado_email || "",
        };
      });

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
            encarregado_nome,
            encarregado_telefone,
            encarregado_email
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

      const students = filtered.map((m: any) => {
        const aluno = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
        return {
          id: m.id,
          alunoId: aluno?.id,
          nome: aluno?.nome || "Aluno Desconhecido",
          processo: aluno?.numero_processo || "N/A",
          foto: aluno?.foto_url,
          valor: 0,
          pago: 0,
          status: m.status,
          vencimento: m.created_at,
          turma: m.turmas?.nome || "Sem Turma",
          encarregado: aluno?.encarregado_nome || "",
          contacto: aluno?.encarregado_telefone || "",
          email: aluno?.encarregado_email || "",
        };
      });

      return NextResponse.json({ ok: true, items: students });
    }

    return NextResponse.json({ ok: false, error: "Fonte de dados inválida" }, { status: 400 });

  } catch (err: any) {
    console.error("[drill-down] fatal", err);
    return NextResponse.json({ ok: false, error: "Erro interno no drill-down" }, { status: 500 });
  }
}
