// apps/web/src/app/api/public/admissoes/[escolaSlug]/candidatar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";

const CandidaturaSchema = z.object({
  // Dados do Candidato (Aluno)
  nome_completo: z.string().trim().min(5, "Nome completo deve ter pelo menos 5 caracteres"),
  email: z.string().email("Email inválido").optional().nullable(),
  telefone: z.string().trim().min(7, "Telefone inválido").optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  sexo: z.enum(["M", "F", "O", "N"]).optional().nullable(),
  pai_nome: z.string().trim().max(160).optional().nullable(),
  mae_nome: z.string().trim().max(160).optional().nullable(),
  
  // Dados do Encarregado
  responsavel_nome: z.string().trim().min(5, "Nome do responsável deve ter pelo menos 5 caracteres"),
  responsavel_contato: z.string().trim().min(7, "Contato do responsável inválido"),
  
  // Dados Acadêmicos Pretendidos
  curso_id: z.string().uuid("Curso obrigatório"),
  ano_letivo: z.coerce.number().int(),
  turma_preferencial_id: z.string().uuid().optional().nullable(),
  turno: z.string().optional().nullable(),

  // Anti-spam (Honeypot)
  hp_field: z.string().max(0).optional(), // Deve estar vazio

  // Documentos e Metadados
  draftId: z.string().uuid().optional(),
  documentos: z.record(z.string()).optional(),
  campos_extras: z.record(z.unknown()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ escolaSlug: string }> }
) {
  try {
    const { escolaSlug } = await params;
    const body = await req.json();

    // 1. Validate Payload (Allowlist via Zod)
    const validation = CandidaturaSchema.safeParse(body);
    if (!validation.success) {
      // Se for erro no honeypot, retornar sucesso falso para desencorajar bots
      const isHoneypotError = validation.error.issues.some(i => i.path.includes("hp_field"));
      if (isHoneypotError) {
        return NextResponse.json({ ok: true, message: "Inscrição processada." }, { status: 201 });
      }

      return NextResponse.json(
        { ok: false, error: validation.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }
    const data = validation.data;

    // 2. Resolve School
    const supabase = supabaseServerRole();
    const { escolaId } = await resolveEscolaParam(supabase as any, escolaSlug);

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 404 });
    }

    // 3. Deduplication Check (Same student/contact for same school/year/course)
    const { data: existing } = await supabase
      .from("candidaturas")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("nome_candidato", data.nome_completo)
      .eq("ano_letivo", data.ano_letivo)
      .eq("curso_id", data.curso_id)
      .contains("dados_candidato", { responsavel_contato: data.responsavel_contato })
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ 
        ok: true, 
        message: "Já recebemos uma inscrição com estes dados. Nossa secretaria entrará em contato em breve.",
        protocolo: existing.id.split("-")[0].toUpperCase(),
      }, { status: 200 });
    }

    // 4. Security & Integrity Checks (Verify if course/turma belong to this school)
    const [courseCheck, turmaCheck] = await Promise.all([
      supabase
        .from("cursos")
        .select("id")
        .eq("id", data.curso_id)
        .eq("escola_id", escolaId)
        .maybeSingle(),
      data.turma_preferencial_id 
        ? supabase
            .from("turmas")
            .select("id")
            .eq("id", data.turma_preferencial_id)
            .eq("escola_id", escolaId)
            .maybeSingle()
        : Promise.resolve({ data: { id: "ok" }, error: null }),
    ]);

    if (!courseCheck.data) {
      return NextResponse.json({ ok: false, error: "Curso inválido para esta escola" }, { status: 400 });
    }
    if (!turmaCheck.data) {
      return NextResponse.json({ ok: false, error: "Turma inválida para esta escola" }, { status: 400 });
    }

    // 5. Prepare Candidacy Data (Strict Mapping)
    const dadosCandidato = {
      nome_completo: data.nome_completo,
      email: data.email || null,
      telefone: data.telefone || null,
      data_nascimento: data.data_nascimento || null,
      sexo: data.sexo || null,
      pai_nome: data.pai_nome || null,
      mae_nome: data.mae_nome || null,
      responsavel_nome: data.responsavel_nome,
      responsavel_contato: data.responsavel_contato,
      documentos: data.documentos || {},
      campos_extras: data.campos_extras || {},
      draft_id: data.draftId || null,
    };

    // 6. Insert Candidacy
    const { data: candidatura, error: insertErr } = await supabase
      .from("candidaturas")
      .insert({
        escola_id: escolaId,
        curso_id: data.curso_id,
        ano_letivo: data.ano_letivo,
        status: "pendente",
        turma_preferencial_id: data.turma_preferencial_id || null,
        dados_candidato: dadosCandidato as any,
        nome_candidato: data.nome_completo,
        turno: data.turno || null,
        source: "PORTAL_PUBLICO",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[Public Candidacy Insert Error]:", insertErr);
      return NextResponse.json({ ok: false, error: "Erro ao processar sua inscrição. Tente novamente." }, { status: 500 });
    }

    // 7. Audit Log
    await supabase.from("audit_logs").insert({
      escola_id: escolaId,
      action: "CANDIDATURA_PUBLICA_CRIADA",
      entity: "candidaturas",
      entity_id: candidatura.id,
      portal: "portal_publico_k12",
      details: { 
        nome: data.nome_completo, 
        curso_id: data.curso_id,
        source: "public_form"
      }
    });

    // 8. Return generic success
    return NextResponse.json({ 
      ok: true, 
      message: "Inscrição realizada com sucesso! A secretaria entrará em contato em breve.",
      protocolo: candidatura.id.split("-")[0].toUpperCase(),
    }, { status: 201 });

  } catch (err) {
    console.error("[Public Candidacy Error]:", err);
    return NextResponse.json({ ok: false, error: "Erro interno ao processar requisição" }, { status: 500 });
  }
}
