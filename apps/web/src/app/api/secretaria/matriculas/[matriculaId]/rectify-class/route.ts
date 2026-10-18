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
const roles: Role[] = ["admin", "admin_escola"];

async function context(matriculaId: string) {
  const supabase = await supabaseServerTyped<any>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const { data: matricula } = await supabase.from("matriculas").select("id,escola_id,aluno_id,turma_id,status").eq("id", matriculaId).maybeSingle();
  if (!matricula) return { error: NextResponse.json({ ok: false, error: "Matrícula não encontrada" }, { status: 404 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, matricula.escola_id);
  if (escolaId !== matricula.escola_id) return { error: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  const { error } = await requireRoleInSchool({ supabase, escolaId: escolaId!, roles });
  if (error) return { error };
  return { supabase, user, matricula, escolaId };
}

async function preview(supabase: any, matricula: any, escolaId: string, turmaId: string) {
  const [origin, target, notes, assessments, appeals, official, payments, charges, monthly, contracts, entries, exams, attendance] = await Promise.all([
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
    supabase.from("frequencia_status_periodo").select("id",{count:"exact",head:true}).eq("matricula_id",matricula.id),
  ]);
  const errors = [origin,target,notes,assessments,appeals,official,payments,charges,monthly,contracts,entries,exams,attendance].filter(x=>x.error).map(x=>x.error.message);
  if (errors.length) throw new Error(`Não foi possível verificar todos os impactos: ${errors.join('; ')}`);
  if (!origin.data || !target.data) throw new Error("Turma de origem ou destino não encontrada.");
  const o=origin.data, t=target.data;
  const {data:targetSession,error:sessionError}=await supabase.from("turmas").select("session_id").eq("id",turmaId).eq("escola_id",escolaId).single();
  if(sessionError || !targetSession) throw new Error("Sessão académica não disponível.");
  const blockers:string[]=[];
  const avisos:string[]=[];
  if(o.classe_id===t.classe_id) blockers.push("Para a mesma classe, utilize Trocar turma.");
  if(o.ano_letivo!==t.ano_letivo || o.curso_id!==t.curso_id || o.session_id!==targetSession.session_id) blockers.push("Ano letivo, sessão ou curso incompatível.");
  if((notes.count||0)+(assessments.count||0)+(appeals.count||0)+(official.count||0)+(exams.count||0)+(attendance.count||0)>0) avisos.push("As notas e pautas anteriores serão preservadas, sem transferência automática para a nova classe.");
  if((payments.count||0)+(charges.count||0)+(monthly.count||0)+(contracts.count||0)+(entries.count||0)>0) avisos.push("Pagamentos, recibos e cobranças existentes serão preservados; confira a tabela de preços da nova classe.");
  const lotada=Number(t.capacidade_maxima)>0 && Number(t.ocupacao_atual)>=Number(t.capacidade_maxima);
  if(lotada) blockers.push("Turma destino sem vagas.");
  return { allow:blockers.length===0, blockers, avisos, requer_confirmacao_historico:avisos.length>0, lotada, vagas_restantes:Math.max(0,Number(t.capacidade_maxima)-Number(t.ocupacao_atual)), mudanca_turno:o.turno!==t.turno, financeiro:{altera_valor:false,valor_antigo:0,valor_novo:0,diferenca:0,mensagem:"A correção de classe não recalcula mensalidades automaticamente. Confirme a tabela de preços da classe destino."} };
}

export async function GET(request:Request,{params}:{params:Promise<{matriculaId:string}>}) {
 try { const {matriculaId}=await params; const turmaId=new URL(request.url).searchParams.get("target_turma_id");
 if(!turmaId || !z.string().uuid().safeParse(turmaId).success) return NextResponse.json({ok:false,error:"Turma inválida"},{status:400});
 const ctx=await context(matriculaId); if(ctx.error)return ctx.error;
 return NextResponse.json(await preview(ctx.supabase,ctx.matricula,ctx.escolaId!,turmaId));
 } catch(e) {return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:409});}
}
export async function PUT(request:Request,{params}:{params:Promise<{matriculaId:string}>}) {
 try { const {matriculaId}=await params; const parsed=Schema.safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({ok:false,error:parsed.error.issues[0]?.message},{status:400});
 const ctx=await context(matriculaId);if(ctx.error)return ctx.error;
 const academic=await resolveAcademicYearContext(ctx.supabase,{userId:ctx.user!.id,requestedAcademicYearId:parsed.data.ano_letivo_id,operation:"WRITE"});
 if(academic.escolaId!==ctx.escolaId)return NextResponse.json({ok:false,error:"Sem permissão"},{status:403});
 await assertAcademicYearEntity(ctx.supabase,{table:"matriculas",entityId:matriculaId,escolaId:ctx.escolaId!,anoLetivoId:academic.anoLetivoId});
 await assertAcademicYearEntity(ctx.supabase,{table:"turmas",entityId:parsed.data.turma_id,escolaId:ctx.escolaId!,anoLetivoId:academic.anoLetivoId});
 const impact=await preview(ctx.supabase,ctx.matricula,ctx.escolaId!,parsed.data.turma_id);
 if(impact.requer_confirmacao_historico && !parsed.data.confirmar_historico)return NextResponse.json({ok:false,error:"Confirme a preservação do histórico antes de avançar.",impact},{status:409});
 if(!impact.allow)return NextResponse.json({ok:false,error:impact.blockers.join(" "),impact},{status:409});
 const {data,error}=await ctx.supabase.rpc("retificar_classe_matricula",{p_matricula_id:matriculaId,p_turma_destino_id:parsed.data.turma_id,p_motivo:parsed.data.motivo,p_confirmar_historico:parsed.data.confirmar_historico});
 if(error)return NextResponse.json({ok:false,error:error.message},{status:409});
 return NextResponse.json({ok:true,matricula_id:data});
 }catch(e){if(e instanceof AcademicYearContextError)return NextResponse.json({ok:false,error:e.message,code:e.code},{status:e.status});return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}
