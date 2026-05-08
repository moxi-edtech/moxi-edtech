import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; turmaId: string }> }
) {
  const { id: escolaId, turmaId } = await params;
  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: "Permissão negada" }, { status: 403 });
    }

    // 1. Get Top 3 students at risk based on attendance (from Phase 2 table)
    const { data: riskStudents } = await (supabase as any)
      .from("frequencia_status_periodo")
      .select(`
        percentual_presenca,
        abaixo_minimo,
        alunos (nome)
      `)
      .eq("turma_id", turmaId)
      .eq("escola_id", userEscolaId)
      .order("percentual_presenca", { ascending: true })
      .limit(3);

    // 2. Get current subject based on published schedule
    const now = new Date();
    let dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (dayOfWeek === 0) dayOfWeek = 7; // Map to 1=Mon...7=Sun

    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

    // Find active schedule version for this turma
    const { data: activeVersion } = await (supabase as any)
        .from("horario_versoes")
        .select("id")
        .eq("turma_id", turmaId)
        .eq("status", "publicada")
        .maybeSingle();

    let currentSubject: { nome: string; professor: string; sala: string; slot_id?: string } | null = null;
    if (activeVersion) {
        // Find the slot for current time and day
        const { data: slot } = await (supabase as any)
            .from("horario_slots")
            .select(`
                id,
                quadro_horarios!inner (
                    disciplinas_catalogo (nome),
                    professores (profiles (full_name)),
                    salas (nome),
                    turma_id,
                    versao_id
                )
            `)
            .eq("escola_id", userEscolaId)
            .eq("dia_semana", dayOfWeek)
            .lte("inicio", currentTime)
            .gte("fim", currentTime)
            .eq("quadro_horarios.turma_id", turmaId)
            .eq("quadro_horarios.versao_id", activeVersion.id)
            .maybeSingle();
        
        if (slot?.quadro_horarios?.[0]) {
            const qh = slot.quadro_horarios[0];
            
            // Check for daily substitution
            const { data: sub } = await (supabase as any)
                .from("substituicoes_professores")
                .select("professores (profiles (full_name))")
                .eq("escola_id", userEscolaId)
                .eq("turma_id", turmaId)
                .eq("slot_id", slot.id)
                .eq("data", now.toISOString().split('T')[0])
                .maybeSingle();

            currentSubject = {
                nome: qh.disciplinas_catalogo?.nome || "Desconhecida",
                professor: sub?.professores?.profiles?.full_name 
                    ? `${sub.professores.profiles.full_name} (Substituto)`
                    : (qh.professores?.profiles?.full_name || "Não atribuído"),
                sala: qh.salas?.nome || "Não definida",
                slot_id: slot.id // Needed for assignment
            };
        }
    }

    return NextResponse.json({
      ok: true,
      data: {
        risks: (riskStudents || []).map((s: any) => ({
          nome: s.alunos?.nome || "Desconhecido",
          motivo: s.abaixo_minimo ? "Frequência Crítica" : "Baixa Assiduidade",
          status: s.abaixo_minimo ? "critical" : "warning"
        })),
        currentSubject
      }
    });
  } catch (err: any) {
    console.error("Quick view error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
