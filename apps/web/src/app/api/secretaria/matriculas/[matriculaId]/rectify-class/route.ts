import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import type { Role } from "@/lib/authz";
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const Schema = z.object({ turma_id: z.string().uuid(), motivo: z.string().trim().min(10).max(300), ano_letivo_id: z.string().uuid(), confirmar_historico: z.boolean().default(false) });
const roles: Role[] = ["secretaria", "admin_secretaria", "admin_secretario", "admin_financeiro", "admin", "admin_escola", "staff_admin", "diretor"];

async function context(matriculaId: string) {
  const supabase = await supabaseServerTyped<any>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return { error: NextResponse.json({ ok: false, error: "Sem permissão", }, { status: 403 }) };
  const { data: matricula, error: matriculaError } = await supabase.from("matriculas")
    .select("id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo")
    .eq("escola_id", escolaId).eq("id", matriculaId).maybeSingle();
  if (matriculaError) throw matriculaError;
  if (!matricula) return { error: NextResponse.json({ ok: false, error: "Matrícula não encontrada", }, { status: 404 }) };
  const { error } = await requireRoleInSchool({ supabase, escolaId: escolaId!, roles });
  if (error) return { error };
  return { supabase, user, matricula, escolaId };
}

async function preview(supabase: any, matricula: any, escolaId: string, turmaId: string) {
  const [origin, target, notes, assessments, appeals, official, payments, charges, monthly, contracts, entries, exams, attendance, frequency, academicEvidence] = await Promise.all([
    supabase.from("turmas").select("id,classe_id,curso_id,ano_letivo,session_id,turno").eq("id",matricula.turma_id).eq("escola_id",escolaId).maybeSingle(),
    supabase.from("vw_turmas_para_matricula").select("id,classe_id,curso_id,ano_letivo,turno,capacidade_maxima,ocupacao_atual").eq("id",turmaId).eq("escola_id",escolaId).maybeSingle(),
    supabase.from("notas").select("id",{count:"exact",head:true}).eq("matricula_id",matricula.id),
    supabase.from("notas_avaliacoes").select("id",{count:"exact",head:true}).eq("matricula_id",matricula.id),
    supabase.from("melhoria_nota_pedidos").select("id",{count:"exact",head:true}).eq("matricula_id",matricula.id),
    supabase.from("pautas_oficiais").select("id",{count:"exact",head:true}).eq("turma_id",matricula.turma_id),
    supabase.from("pagamentos").select("id",{count:"exact",head:true}).eq("aluno_id",matricula.aluno_id).eq("escola_id",escolaId),
    supabase.from("financeiro_cobrancas").select("id",{count:"exact",head:true}).eq("aluno_id",matricula.aluno_id).eq("escola_id",escolaId),
    supabase.from("mensalidades").select("id",{count:"exact",head:true}).eq("matricula_id",matricula.id),
    supabase.from("financeiro_contratos").select("id",{count:"exact",head:true}).eq("matricula_id",matricula.id),
    supabase.from("financeiro_lancamentos").select("id",{count:"exact",head:true}).eq("matricula_id",matricula.id),
    supabase.from("exame_resultados").select("id",{count:"exact",head:true}).eq("matricula_id",matricula.id),
    supabase.from("frequencia_status_periodo").select("id",{count:"exact",head:true}).eq("matricula_id",matricula.id).eq("escola_id",escolaId),
    supabase.from("frequencias").select("id",{count:"exact",head:true}).eq("matricula_id",matricula.id).eq("escola_id",escolaId),
    supabase.rpc("turma_transfer_academic_evidence_v1", {p_matricula_id:matricula.id}),
  ]);
  const errors = [origin,target,notes,assessments,appeals,official,payments,charges,monthly,contracts,entries,exams,attendance,frequency,academicEvidence].filter(x=>x.error).map(x=>x.error.message);
  if (typeof academicEvidence.data?.has_evidence !== "boolean") errors.push("Histórico académico sem validação canónica");
  if (errors.length) throw new Error(`Não foi possível verificar todos os impactos: ${errors.join('; ')}`);
  if (!origin.data || !target.data) throw new Error("Turma de origem ou destino não encontrada.");
  const o=origin.data, t=target.data;
  const {data:targetSession,error:sessionError}=await supabase.from("turmas").select("session_id").eq("id",turmaId).eq("escola_id",escolaId).single();
  if(sessionError || !targetSession) throw new Error("Sessão académica não disponível.");
  const blockers:string[]=[];
  const avisos:string[]=[];
  if(o.classe_id===t.classe_id) blockers.push("Para a mesma classe, utilize Trocar turma.");
  if (matricula.session_id !== o.session_id || matricula.session_id !== targetSession.session_id) blockers.push("Matrícula e turma não pertencem à mesma sessão.");
  if (matricula.ativo !== true || !["ativo","ativa","active"].includes(String(matricula.status).toLowerCase())) blockers.push("A correção direta exige matrícula ativa.");
  if(o.ano_letivo!==t.ano_letivo || o.session_id!==targetSession.session_id) blockers.push("Ano letivo ou sessão incompatível.");
  const requerConciliacaoAcademica = academicEvidence.data.has_evidence === true ||
    (notes.count||0)+(assessments.count||0)+(appeals.count||0)
    +(exams.count||0)+(attendance.count||0)+(frequency.count||0)>0;
  if (requerConciliacaoAcademica) blockers.push(
    "A matrícula possui notas, avaliações, exames ou frequência. A retificação exige conciliação académica antes de alterar a turma."
  );
  if ((official.count||0)>0) blockers.push(
    "A turma de origem possui pautas oficiais; não é seguro retificar a classe sem preservar o documento histórico."
  );
  if((payments.count||0)+(charges.count||0)+(monthly.count||0)+(contracts.count||0)+(entries.count||0)>0) avisos.push("Pagamentos, recibos e cobranças existentes serão preservados; confira a tabela de preços da nova classe.");
  const capacidade=Number(t.capacidade_maxima??0);
  const lotada=capacidade<=0 || Number(t.ocupacao_atual)>=capacidade;
  if (capacidade<=0) blockers.push("Configure a capacidade da turma destino.");
  else if(lotada) blockers.push("Turma destino sem vagas.");
  return { allow:blockers.length===0,
    code: requerConciliacaoAcademica ? "TRANSFER_ACADEMIC_RECONCILIATION_REQUIRED" : null,
    requer_conciliacao_academica: requerConciliacaoAcademica,
    blockers, avisos, requer_confirmacao_historico:avisos.length>0, lotada, vagas_restantes:Math.max(0,Number(t.capacidade_maxima)-Number(t.ocupacao_atual)), mudanca_turno:o.turno!==t.turno, financeiro:{altera_valor:false,valor_antigo:0,valor_novo:0,diferenca:0,mensagem:"A correção de classe não recalcula mensalidades automaticamente. Confirme a tabela de preços da classe destino."} };
}

export async function GET(request:Request,{params}:{params:Promise<{matriculaId:string}>}) {
 try {
  const { matriculaId } = await params;
  if (!z.string().uuid().safeParse(matriculaId).success)
    return NextResponse.json({ok:false,error:"Matrícula inválida."},{status:400});
  const ctx = await context(matriculaId);
  if (ctx.error) return ctx.error;
  const { supabase, matricula, escolaId } = ctx;
  const { data: ano, error: anoError } = await supabase.from("anos_letivos")
    .select("id,ano,ativo").eq("escola_id",escolaId).eq("id",matricula.session_id).maybeSingle();
  if (anoError || !ano || ano.ativo !== true || Number(ano.ano) !== Number(matricula.ano_letivo) ||
      matricula.ativo !== true || !["ativo","ativa","active"].includes(String(matricula.status).toLowerCase()))
    return NextResponse.json({ok:false,error:"Só é possível corrigir diretamente uma matrícula ativa do ano letivo corrente."},{status:409});
  const turmaId = new URL(request.url).searchParams.get("target_turma_id");
  if (turmaId) {
    if (!z.string().uuid().safeParse(turmaId).success)
      return NextResponse.json({ok:false,error:"Turma inválida."},{status:400});
    return NextResponse.json(await preview(supabase, matricula, escolaId!, turmaId), {
      headers: {"Cache-Control":"private, no-store"},
    });
  }
  // The options are scoped to the SAME student's enrollment and year;
  // no RAA progression filter is applicable to correction of a data-entry error.
  const { data: turmas, error } = await supabase.from("turmas")
    .select("id,nome,classe_num,classe_id,curso_id,turno,capacidade_maxima")
    .eq("escola_id",escolaId).eq("session_id",matricula.session_id)
    .eq("status_validacao","ativo")
    .order("classe_num",{ascending:true}).order("nome",{ascending:true}).limit(300);
  if (error) throw error;
  if ((turmas??[]).length===300)
    return NextResponse.json({ok:false,error:"Existem demasiadas turmas; refine o catálogo antes da correção."},{status:409});
  return NextResponse.json({
    ok:true, matricula_id:matricula.id, aluno_id:matricula.aluno_id,
    turma_atual_id:matricula.turma_id, ano_letivo_id:ano.id, ano_letivo:ano.ano,
    items:turmas??[],
  },{headers:{"Cache-Control":"private, no-store"}});
 } catch(e) { return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Falha ao consultar."},{status:409}); }
}
export async function PUT(request:Request,{params}:{params:Promise<{matriculaId:string}>}) {
 try { const {matriculaId}=await params; const parsed=Schema.safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({ok:false,error:parsed.error.issues[0]?.message},{status:400});
 const ctx=await context(matriculaId);if(ctx.error)return ctx.error;
 if (!ctx.matricula || !ctx.matricula.session_id || ctx.matricula.session_id !== parsed.data.ano_letivo_id) {
   return NextResponse.json({ok:false,code:"ENROLLMENT_STALE",error:"A sessão da matrícula mudou; atualize a situação."},{status:409});
 }
 const academic=await resolveAcademicYearContext(ctx.supabase,{userId:ctx.user!.id,requestedAcademicYearId:parsed.data.ano_letivo_id,operation:"WRITE"});
 if(academic.escolaId!==ctx.escolaId)return NextResponse.json({ok:false,error:"Sem permissão"},{status:403});
 await assertAcademicYearEntity(ctx.supabase,{table:"matriculas",entityId:matriculaId,escolaId:ctx.escolaId!,anoLetivoId:academic.anoLetivoId});
 await assertAcademicYearEntity(ctx.supabase,{table:"turmas",entityId:parsed.data.turma_id,escolaId:ctx.escolaId!,anoLetivoId:academic.anoLetivoId});
 const impact=await preview(ctx.supabase,ctx.matricula,ctx.escolaId!,parsed.data.turma_id);
 if(impact.requer_confirmacao_historico && !parsed.data.confirmar_historico)return NextResponse.json({ok:false,error:"Confirme a preservação do histórico antes de avançar.",impact},{status:409});
 if(!impact.allow)return NextResponse.json({ok:false,error:impact.blockers.join(" "),impact},{status:409});
 const {data,error}=await ctx.supabase.rpc("retificar_classe_matricula",{p_matricula_id:matriculaId,p_turma_destino_id:parsed.data.turma_id,p_motivo:parsed.data.motivo,p_confirmar_historico:parsed.data.confirmar_historico});
 if(error)return NextResponse.json({
    ok:false, error:error.message,
    code: error.code === "P1050" ? "TRANSFER_ACADEMIC_RECONCILIATION_REQUIRED" : error.code,
  },{status:409});
 return NextResponse.json({ok:true,matricula_id:data});
 }catch(e){if(e instanceof AcademicYearContextError)return NextResponse.json({ok:false,error:e.message,code:e.code},{status:e.status});return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}
