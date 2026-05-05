// src/components/aluno/PortalAlunoLayout.tsx
// Componente orquestrador — gere estado de navegação e switch de aluno
// Substitui o AlunoLayoutClient actual
'use client';

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

import { AlunoHeader }    from "./layout/AlunoHeader";
import { AlunoBottomNav } from "./layout/AlunoBottomNav";
import { TabHome }        from "./tabs/TabHome";
import { TabNotas }       from "./tabs/TabNotas";
import { TabFinanceiro }  from "./tabs/TabFinanceiro";
import { TabDocumentos }  from "./tabs/TabDocumentos";
import { TabNotificacoes } from "./tabs/TabNotificacoes";

import type { Educando, Nota, Pagamento, Presenca, Notificacao, TabId } from "./types";

// ─── Tipos de dados do portal ─────────────────────────────────────────────────

interface PortalData {
  notas:         Nota[];
  pagamentos:    Pagamento[];
  presencas:     Presenca[];
  notificacoes:  Notificacao[];
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PortalAlunoLayout({ children }: { children?: React.ReactNode }) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [ready,      setReady]      = useState(false);
  const [escolaNome, setEscolaNome] = useState<string | null>(null);
  const [educandos,  setEducandos]  = useState<Educando[]>([]);
  const [tab,        setTab]        = useState<TabId>("home");
  const [switching,  setSwitching]  = useState(false);
  const [data,       setData]       = useState<PortalData>({
    notas: [], pagamentos: [], presencas: [], notificacoes: [],
  });

  // Aluno activo — via searchParams ou primeiro da lista
  const alunoId = useMemo(
    () => searchParams?.get("aluno") ?? educandos[0]?.id ?? null,
    [searchParams, educandos],
  );
  const alunoActivo = useMemo(
    () => educandos.find(e => e.id === alunoId) ?? educandos[0] ?? null,
    [educandos, alunoId],
  );

  // ── Auth + fetch inicial ──────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const s = createClient();

    (async () => {
      const { data: userRes } = await s.auth.getUser();
      const user = userRes?.user;
      if (!user) { router.replace("/redirect"); return; }

      // Vínculo à escola
      const { data: vinc } = await s
        .from("escola_users")
        .select("escola_id, papel, role")
        .eq("user_id", user.id)
        .limit(10);

      const vincPortal = (vinc || []).find(v => {
        const papel = v.papel ?? v.role ?? null;
        return papel === "aluno" || papel === "encarregado";
      });

      if (!vincPortal?.escola_id) { router.replace("/"); return; }

      const escolaId = vincPortal.escola_id;

      // Escola
      const { data: esc } = await s
        .from("escolas")
        .select("nome, aluno_portal_enabled, status")
        .eq("id", escolaId)
        .maybeSingle();

      if (esc?.status === "suspensa") { router.replace("/escola/suspensa"); return; }
      if (!esc?.aluno_portal_enabled && pathname !== "/aluno/desabilitado") {
        router.replace("/aluno/desabilitado"); return;
      }

      // Alunos directos + via encarregado (em paralelo)
      const [{ data: alunosDiretos }, { data: encarregado }] = await Promise.all([
        s.from("alunos").select("id, nome, escola_id").eq("profile_id", user.id).eq("escola_id", escolaId).limit(20),
        user.email
          ? s.from("encarregados").select("id").eq("escola_id", escolaId).ilike("email", user.email).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      let alunosVinculados: Educando[] = [];
      if (encarregado?.id) {
        const { data: links } = await s
          .from("aluno_encarregados")
          .select("aluno:alunos!aluno_encarregados_aluno_id_fkey(id, nome, escola_id)")
          .eq("escola_id", escolaId)
          .eq("encarregado_id", encarregado.id)
          .limit(20);

        alunosVinculados = (links || [])
          .map(r => r.aluno).flat().filter(Boolean) as Educando[];
      }

      // Merge sem duplicados + enriquecer com avatar/cor
      const CORES = ["#1F6B3B","#1a5c8c","#7c3aed","#b45309","#0e7490"];
      const merged = [...(alunosDiretos || []), ...alunosVinculados]
        .reduce<Educando[]>((acc, row, i) => {
          if (acc.some(a => a.id === row.id)) return acc;
          const partes = (row.nome ?? "").trim().split(/\s+/);
          const initials = partes.length >= 2
            ? `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase()
            : (partes[0]?.[0] ?? "?").toUpperCase();
          acc.push({
            id:       row.id,
            nome:     row.nome ?? "Educando",
            classe:   "—",       // enriquecer com fetch separado se necessário
            turma:    "—",
            avatar:   initials,
            cor:      CORES[i % CORES.length],
            escola_id: row.escola_id,
          });
          return acc;
        }, []);

      if (!active) return;
      setEscolaNome(esc?.nome ?? null);
      setEducandos(merged);
      setReady(true);
    })();

    return () => { active = false; };
  }, [pathname, router]);

  // ── Fetch de dados do aluno activo ────────────────────────────────────────
  useEffect(() => {
    if (!alunoId || !ready) return;
    // TODO: substituir por fetch real dos dados do aluno
    // ex: fetchNotasAluno(alunoId), fetchPagamentosAluno(alunoId), etc.
    // setData({ notas, pagamentos, presencas, notificacoes });
  }, [alunoId, ready]);

  // ── Troca de aluno ────────────────────────────────────────────────────────
  const handleSwitchAluno = (aluno: Educando) => {
    setSwitching(true);
    setTimeout(() => {
      setTab("home");
      setSwitching(false);
      router.push(`?aluno=${aluno.id}`);
    }, 200);
  };

  const naoLidas = data.notificacoes.filter(n => !n.lida).length;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div style={{
        minHeight: "100svh", background: "#060d08",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans', system-ui",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #1F6B3B, #2d9655)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900, color: "#fff",
            margin: "0 auto 12px",
          }}>KL</div>
          <p style={{ fontSize: 12, color: "#374151" }}>A verificar acesso…</p>
        </div>
      </div>
    );
  }

  if (!alunoActivo) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@500;600;700&family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        ::-webkit-scrollbar { width: 2px }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 2px }
      `}</style>

      <div style={{
        minHeight: "100svh",
        background: "#060d08",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: "#f0fdf4",
        maxWidth: 430,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}>

        <AlunoHeader
          escolaNome={escolaNome}
          educandos={educandos}
          alunoActivo={alunoActivo}
          tabActiva={tab}
          onSwitchAluno={handleSwitchAluno}
          onBack={() => setTab("home")}
        />

        <main style={{
          flex: 1,
          padding: "16px 16px 100px",
          opacity:    switching ? 0 : 1,
          transform:  switching ? "translateY(6px)" : "translateY(0)",
          transition: "all 0.2s ease",
          animation:  "fadeUp 0.3s ease",
        }}>
          {tab === "home"         && (
            <TabHome
              aluno={alunoActivo}
              notas={data.notas}
              pagamentos={data.pagamentos}
              presencas={data.presencas}
              onNav={setTab}
            />
          )}
          {tab === "notas"        && <TabNotas        notas={data.notas}                />}
          {tab === "financeiro"   && <TabFinanceiro   pagamentos={data.pagamentos}       />}
          {tab === "documentos"   && <TabDocumentos                                      />}
          {tab === "notificacoes" && <TabNotificacoes notificacoes={data.notificacoes}   />}
        </main>

        <AlunoBottomNav
          tabActiva={tab}
          onNav={setTab}
          notificacoesNaoLidas={naoLidas}
        />
      </div>
    </>
  );
}
