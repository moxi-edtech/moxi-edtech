"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

export default function TurmasConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  const menuItems = [
    { label: "📅 Calendário", href: `${base}/calendario` },
    { label: "📊 Avaliação", href: `${base}/avaliacao` },
    { label: "👥 Turmas", href: `${base}/turmas` },
    { label: "💰 Financeiro", href: `${base}/financeiro` },
    { label: "🔄 Fluxos", href: `${base}/fluxos` },
    { label: "⚙️ Avançado", href: `${base}/avancado` },
  ];

  const [impact, setImpact] = useState<{ turmas?: number; alunos?: number; professores?: number }>({});
  const [cursos, setCursos] = useState<Array<{ id: string; nome: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; curso_id?: string; nome: string; turno?: string }>>([]);
  const [curriculos, setCurriculos] = useState<Array<{ curso_id: string; status: string; version: number; ano_letivo_id: string }>>([]);
  const [anoLetivo, setAnoLetivo] = useState<{ id: string; ano: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!escolaId) return;
    const load = async () => {
      const cursosRes = await fetch(`/api/escolas/${escolaId}/cursos`, { cache: "no-store" });
      const cursosJson = await cursosRes.json().catch(() => null);
      if (cursosRes.ok && cursosJson?.ok) setCursos(cursosJson.data ?? []);

      const classesRes = await fetch(`/api/escolas/${escolaId}/classes`, { cache: "no-store" });
      const classesJson = await classesRes.json().catch(() => null);
      if (classesRes.ok && classesJson?.ok) setClasses(classesJson.data ?? []);

      const curriculoRes = await fetch(`/api/escola/${escolaId}/admin/curriculo/status`, { cache: "no-store" });
      const curriculoJson = await curriculoRes.json().catch(() => null);
      if (curriculoRes.ok && curriculoJson?.ok) {
        setCurriculos(curriculoJson.curriculos ?? []);
        setAnoLetivo(curriculoJson.ano_letivo ?? null);
      }

      const res = await fetch(`/api/escola/${escolaId}/admin/setup/impact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setImpact({
          turmas: json.data?.counts?.turmas_afetadas,
          alunos: json.data?.counts?.alunos_afetados,
          professores: json.data?.counts?.professores_afetados,
        });
      }
    };
    load();
  }, [escolaId]);

  const handleSave = async () => {
    if (!escolaId) return;
    setSaving(true);
    try {
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { turmas: true } }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (cursoId: string) => {
    if (!escolaId || !anoLetivo) return;
    const curriculo = curriculos.find((c) => c.curso_id === cursoId);
    if (!curriculo) return;
    await fetch(`/api/escola/${escolaId}/admin/curriculo/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cursoId,
        anoLetivoId: curriculo.ano_letivo_id,
        version: curriculo.version,
        rebuildTurmas: true,
      }),
    });
  };

  const handleGenerate = async (cursoId: string) => {
    if (!escolaId || !anoLetivo) return;
    const turmasPayload = classes
      .filter((c) => c.curso_id === cursoId)
      .map((c) => ({
        classeId: c.id,
        turno: (c.turno as "M" | "T" | "N") ?? "M",
        quantidade: 1,
      }));
    if (turmasPayload.length === 0) return;
    await fetch(`/api/escola/${escolaId}/admin/turmas/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cursoId,
        anoLetivo: anoLetivo.ano,
        turmas: turmasPayload,
      }),
    });
  };

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Turmas · Geração e Validação"
      subtitle="As turmas devem nascer do currículo publicado."
      menuItems={menuItems}
      prevHref={`${base}/avaliacao`}
      nextHref={`${base}/financeiro`}
      testHref={`${base}/sandbox`}
      impact={impact}
      onSave={handleSave}
      saveDisabled={saving}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          Gere turmas automaticamente a partir do currículo publicado e valide disciplinas por turma.
        </div>
        <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600 space-y-3">
          <p className="font-semibold text-slate-700">Cursos e status do currículo</p>
          {cursos.length === 0 && <p>Nenhum curso disponível.</p>}
          {cursos.map((curso) => {
            const curriculo = curriculos.find((c) => c.curso_id === curso.id);
            const status = curriculo?.status ?? 'nenhum';
            return (
              <div key={curso.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2">
                <span>{curso.nome} · {status}</span>
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => handlePublish(curso.id)}
                    disabled={!curriculo}
                  >
                    Publicar currículo
                  </button>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    onClick={() => handleGenerate(curso.id)}
                  >
                    Gerar turmas
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <Link
          href={escolaId ? `/escola/${escolaId}/admin/turmas` : "#"}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Abrir painel real de turmas
        </Link>
      </div>
    </ConfigSystemShell>
  );
}
