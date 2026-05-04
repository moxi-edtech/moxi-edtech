import { NextRequest, NextResponse } from "next/server";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ escolaSlug: string }> }
) {
  try {
    const { escolaSlug } = await params;
    const { searchParams } = new URL(req.url);
    const protocolo = searchParams.get("protocolo")?.toUpperCase();
    const contato = searchParams.get("contato")?.trim();

    if (!protocolo || !contato) {
      return NextResponse.json(
        { ok: false, error: "Protocolo e contato são obrigatórios" },
        { status: 400 }
      );
    }

    // 1. Resolve School
    const supabase = supabaseServerRole();
    const { escolaId } = await resolveEscolaParam(supabase as any, escolaSlug);

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 404 });
    }

    // 2. Search Candidacy
    // Como o protocolo é o prefixo do UUID, buscamos por candidaturas daquela escola
    // que comecem com aquele ID.
    const { data: candidaturas, error: searchErr } = await supabase
      .from("candidaturas")
      .select(`
        id, 
        status, 
        nome_candidato, 
        created_at, 
        dados_candidato,
        curso:cursos(nome)
      `)
      .eq("escola_id", escolaId)
      .filter("id", "ilike", `${protocolo.toLowerCase()}%`);

    if (searchErr) {
      console.error("[Status Inquiry Search Error]:", searchErr);
      return NextResponse.json({ ok: false, error: "Erro ao buscar candidatura" }, { status: 500 });
    }

    // 3. Validate Contact (Security layer)
    // Filtramos as candidaturas encontradas para ver se o contato bate
    const match = candidaturas?.find((c: any) => {
      const dados = c.dados_candidato as any;
      return (
        dados?.email?.toLowerCase() === contato.toLowerCase() ||
        dados?.telefone === contato ||
        dados?.responsavel_contato === contato
      );
    });

    if (!match) {
      return NextResponse.json(
        { ok: false, error: "Candidatura não encontrada ou dados de contato incorretos" },
        { status: 404 }
      );
    }

    // 4. Return Status Information
    return NextResponse.json({
      ok: true,
      data: {
        protocolo: match.id.split("-")[0].toUpperCase(),
        status: match.status,
        nome_candidato: match.nome_candidato,
        curso: match.curso?.nome || "Não informado",
        data_submissao: match.created_at,
      }
    });

  } catch (err) {
    console.error("[Status Inquiry Error]:", err);
    return NextResponse.json({ ok: false, error: "Erro interno ao processar requisição" }, { status: 500 });
  }
}
