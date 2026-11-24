import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { daySchema, expedienteAccess, todayLuanda } from "@/lib/secretaria/expediente";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_ROWS = 10000;
const MAX_DAYS = 31;
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });
const dateLabel = (value: string) => value.split("-").reverse().join("/");
const money = (v: unknown) => new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0)) + " Kz";
const clock = (value: string) => new Intl.DateTimeFormat("pt-PT", { timeZone: "Africa/Luanda", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const entities: Record<string,string> = { alunos:"Alunos", candidaturas:"Candidaturas", matriculas:"Matrículas", pagamentos:"Pagamentos", documentos_emitidos:"Documentos emitidos", servico_pedidos:"Pedidos de serviço", mensalidades:"Propinas", notas:"Notas", financeiro_lancamentos:"Lançamentos financeiros", financeiro_estornos:"Estornos", reapreciacao_pedidos:"Reapreciações", frequencias:"Frequências",aluno_encarregados:"Encarregados",matricula_reclassificacoes:"Reclassificações",matricula_desistencia_sinalizacoes:"Desistências",matricula_desistencia_reativacoes:"Reativações",financeiro_pagamento_alocacoes:"Alocações",financeiro_pagamento_reversoes:"Reversões",financeiro_cobrancas:"Cobranças",financeiro_reconciliacoes_mensalidades:"Reconciliações",pautas_oficiais:"Pautas oficiais",pauta_conclusoes:"Conclusões de pauta",excecoes_pauta:"Exceções de pauta",professores:"Professores",turmas:"Turmas",turma_disciplinas:"Disciplinas",turma_disciplinas_professores:"Atribuições de professores",quadro_horarios:"Quadro de horários",horario_slots:"Tempos de horário",horario_versoes:"Versões de horário",horario_eventos:"Eventos de horário",aluno_falta_justificacoes:"Justificações de faltas",frequencia_status_periodo:"Fecho de frequência",rematricula_janelas:"Janelas de rematrícula",atendimentos_balcao:"Atendimentos",balcao_academic_operacoes:"Operações académicas do Balcão",balcao_historic_recovery_requests:"Pedidos de recuperação histórica",balcao_late_reenroll_authorizations:"Autorizações de rematrícula",melhoria_nota_pedidos:"Pedidos de melhoria de nota",official_document_exports:"Exportações documentais",virada_importacoes:"Importações de virada" };
const actions: Record<string,string> = { CREATE:"Criação", UPDATE:"Alteração", DELETE:"Remoção" };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await expedienteAccess((await params).id);
    if (!access.ok) return fail("Sem acesso ao expediente.", access.status);
    const { supabase, escolaId } = access;
    const url = new URL(req.url);
    const start = daySchema.safeParse(url.searchParams.get("from") ?? url.searchParams.get("date") ?? todayLuanda());
    const end = daySchema.safeParse(url.searchParams.get("to") ?? (start.success ? start.data : ""));
    if (!start.success || !end.success || end.data < start.data || end.data > todayLuanda() || (Date.parse(end.data) - Date.parse(start.data)) / 86400000 >= MAX_DAYS) return fail("Selecione um intervalo de até 31 dias.", 400);
    const [school, closes, cash, captureStart] = await Promise.all([
      supabase.from("escolas").select("nome").eq("id", escolaId).single(),
      supabase.from("secretaria_expedientes").select("id,day_key,closed_at,closed_by,operation_count,business_count,human_count,system_count,summary").eq("escola_id", escolaId).gte("day_key", start.data).lte("day_key", end.data).order("day_key").limit(MAX_DAYS),
      supabase.from("fecho_caixa").select("id,day_key,status,revision,revision_reason,declared_cash,declared_tpa,declared_transfer,declared_mcx,system_cash,system_tpa,system_transfer,system_mcx,system_other,system_other_count,approval_variation,approval_note").eq("escola_id", escolaId).gte("day_key", start.data).lte("day_key", end.data).order("day_key").limit(MAX_DAYS),
      supabase.rpc("secretaria_expediente_capture_started_at", { p_escola_id: escolaId }),
    ]);
    if (captureStart.error || !captureStart.data || school.error || closes.error || cash.error) return fail("Falha ao consultar os fechos.", 500);
    if (!closes.data?.length) return fail("Não existem expedientes fechados neste intervalo.", 404);
    const cashIds=(cash.data??[]).map((c:any)=>c.id);
    const revisions=cashIds.length?await supabase.from("fecho_caixa_revisoes").select("fecho_id,revision,snapshot,archived_at").eq("escola_id",escolaId).in("fecho_id",cashIds).order("revision",{ascending:true}).limit(501):null;
    if(revisions?.error)return fail("Falha ao consultar as versões do caixa.",500);
    if((revisions?.data?.length??0)>500)return fail("Reduza o intervalo de exportação para incluir todas as versões.",413);
    const days = closes.data.map((item: any) => item.day_key);
    // Bound the export, and fail explicitly instead of silently dropping rows.
    const rows: any[] = [];
    let cursor = 0;
    const watermark = await supabase.from("secretaria_expediente_operacoes").select("id").eq("escola_id", escolaId).in("day_key", days).order("id", { ascending: false }).limit(1).maybeSingle();
    if (watermark.error) return fail("Falha ao consultar operações.", 500);
    const maxId = watermark.data?.id ?? 0;
    while (cursor < maxId) {
      const page = await supabase.from("secretaria_expediente_operacoes").select("id,day_key,occurred_at,actor_id,actor_role,origin,entity,entity_id,action,record_kind,transaction_id,is_after_close,detail").eq("escola_id", escolaId).in("day_key", days).gt("id", cursor).lte("id", maxId).order("id").limit(500);
      if (page.error) return fail("Falha ao consultar operações.", 500);
      if (!page.data?.length) break;
      rows.push(...page.data);
      if (rows.length > MAX_ROWS) return fail("Volume demasiado elevado. Reduza o intervalo de exportação.", 413);
      cursor = page.data[page.data.length - 1].id;
    }
    const actorIds = [...new Set<string>([...rows.map(r => r.actor_id).filter((id): id is string => typeof id === "string"), ...closes.data.map((r: any) => r.closed_by)])];
    const names = new Map<string,string>();
    for (let i = 0; i < actorIds.length; i += 100) {
      const { data } = await supabase.from("profiles").select("user_id,nome").eq("escola_id", escolaId).in("user_id", actorIds.slice(i,i+100));
      for (const p of data ?? []) names.set(p.user_id, p.nome ?? p.user_id);
    }
    const pdf = await PDFDocument.create();
    pdf.setTitle("Fecho diário da secretaria");
    pdf.setAuthor("KLASSE");
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const safe = (value: unknown) => Array.from(String(value ?? "—")).map(c => { try { font.widthOfTextAtSize(c,10); return c; } catch { return "?"; } }).join("").replace(/[\r\n\t]/g," ");
    let page: PDFPage;
    let y = 0;
    let currentDay = "";
    const openPage = () => {
      page = pdf.addPage([595.28,841.89]);
      y = 805;
      const name = safe(school.data?.nome ?? "Escola");
      const nameSize = Math.min(12, 525 / Math.max(1,bold.widthOfTextAtSize(name,1)));
      page.drawText(name,{x:35,y,font:bold,size:nameSize,color:rgb(.12,.42,.23)});
      y -= 21;
      page.drawText("Fecho diário da secretaria | " + dateLabel(currentDay),{x:35,y,font:bold,size:12});
      y -= 23;
    };
    const line = (value: unknown, emphasis = false) => {
      const f = emphasis ? bold : font;
      let buffer = "";
      const emit = () => { if (y < 50) openPage(); page.drawText(buffer,{x:35,y,font:f,size:10}); y -= 15; buffer=""; };
      for (const c of safe(value)) {
        if (buffer && f.widthOfTextAtSize(buffer+c,10)>525) emit();
        buffer+=c;
      }
      if(buffer) emit();
    };
    const cashByDay = new Map<string,any>(cash.data?.map((c:any)=>[c.day_key,c]) ?? []);
    for (const close of closes.data) {
      currentDay = close.day_key;
      openPage();
      line("Fechado em "+clock(close.closed_at)+" | Responsável: "+(names.get(close.closed_by)??close.closed_by));
      line("Registos de atividade no fecho: "+close.operation_count,true);
      line("Humanos: "+close.human_count+" | Automáticos: "+close.system_count+" | Registos de negócio distintos: "+close.business_count);
      if (close.day_key === new Intl.DateTimeFormat("sv-SE",{timeZone:"Africa/Luanda",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(captureStart.data))) line("Cobertura parcial: registo ativado em "+clock(captureStart.data));
      for (const [entity,count] of Object.entries(close.summary ?? {})) line((entities[entity]??entity)+": "+count);
      const c = cashByDay.get(close.day_key);
      line("Caixa: "+(c?.status === "approved" ? "Aprovado" : c?.status === "declared" ? "Declarado" : c?.status === "rejected" ? "Rejeitado" : "Sem declaração"),true);
      if(c)line("Versão "+c.revision+(c.revision_reason?" | Motivo: "+c.revision_reason:""));
      if(c?.approval_note)line("Justificação da decisão: "+c.approval_note);
      if(c?.approval_variation&&Object.values(c.approval_variation).some(n=>Number(n)!==0)){
        line("Variação registada na decisão:",true);
        for(const [key,label] of [["cash","Numerário"],["tpa","TPA"],["transfer","Transferências"],["mcx","MCX"],["other","Não classificado"]]) if(Number(c.approval_variation[key]??0)!==0)line(label+": "+money(c.approval_variation[key]));
      }
      if(c&&Number(c.system_other_count)>0)line("Meio não classificado: "+money(c.system_other)+" ("+c.system_other_count+" pagamentos)",true);
      if(c) for(const [key,label] of [["cash","Numerário"],["tpa","TPA"],["transfer","Transferências"],["mcx","MCX"]]) line(label+": declarado "+money(c["declared_"+key])+" | sistema "+money(c["system_"+key])+" | diferença "+money(Number(c["declared_"+key])-Number(c["system_"+key])));
      for(const rev of revisions?.data??[])if(rev.fecho_id===c?.id){
        line("Versão anterior "+rev.revision+" | "+clock(rev.archived_at),true);
        line("Estado: "+rev.snapshot.status+" | Decisão: "+(rev.snapshot.approval_note??"—"));
        for(const [key,label] of [["cash","Numerário"],["tpa","TPA"],["transfer","Transferências"],["mcx","MCX"]])line(label+": declarado "+money(rev.snapshot["declared_"+key])+" | sistema "+money(rev.snapshot["system_"+key]));
      }
      const dayRows = rows.filter(r=>r.day_key===close.day_key);
      for (const late of [false,true]) {
        const filtered = dayRows.filter(r=>r.is_after_close===late);
        line((late?"Adendos posteriores ao fecho":"Operações até ao fecho")+" ("+filtered.length+")",true);
        for(const r of filtered){
          line(clock(r.occurred_at)+" | "+(actions[r.action]??r.action)+" "+(entities[r.entity]??r.entity)+" | "+(r.origin==="service_role"?"Sistema (automático)":names.get(r.actor_id)??r.actor_id));
          line((r.record_kind==="business"?"Negócio":"Mutação")+" | Tx "+r.transaction_id+" | Referência: "+r.entity_id+(r.detail?.status?" | Estado: "+r.detail.status:"")+(r.detail?.payment_day&&r.detail.payment_day!==r.day_key?" | Data financeira: "+r.detail.payment_day:"")+(r.detail?.valor?" | Valor: "+money(r.detail.valor):""));
        }
      }
    }
    const pages = pdf.getPages();
    pages.forEach((p,i)=>p.drawText("Gerado por KLASSE | www.klasse.ao | "+(i+1)+"/"+pages.length,{x:35,y:24,font,size:8,color:rgb(.35,.4,.45)}));
    const bytes = await pdf.save();
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type":"application/pdf", "Content-Disposition":'attachment; filename="fecho-diario-'+start.data+'-'+end.data+'.pdf"', "Cache-Control":"private, no-store" } });
  } catch { return fail("Não foi possível gerar o PDF.",500); }
}
