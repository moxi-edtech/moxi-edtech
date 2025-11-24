"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Label } from "~/components/ui/Label";
import { Select } from "~/components/ui/Select";
import type { GrupoMatricula, MatriculaMassaPayload } from "~types/matricula";

interface MatriculasEmMassaProps {
  importId: string;
  escolaId: string;
}

interface TurmaOption {
  id: string;
  nome: string;
}

export function MatriculasEmMassa({ importId, escolaId }: MatriculasEmMassaProps) {
  const [grupos, setGrupos] = useState<GrupoMatricula[]>([]);
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [selectedTurmas, setSelectedTurmas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});

  const grupoKey = (grupo: Pick<GrupoMatricula, "classe_label" | "turma_label" | "ano_letivo">) =>
    `${grupo.classe_label}-${grupo.turma_label}-${grupo.ano_letivo}`;

  const loadGrupos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/migracao/${importId}/pre-matriculas`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Falha ao carregar pré-matrículas");
      }
      const payload = (await response.json()) as { grupos: GrupoMatricula[] };
      setGrupos(payload.grupos || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadTurmas = async () => {
    if (!escolaId) return;
    try {
      const response = await fetch(`/api/escolas/${escolaId}/turmas`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível carregar turmas");
      }
      setTurmas(payload.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao buscar turmas";
      setError(message);
    }
  };

  useEffect(() => {
    void loadGrupos();
  }, [importId]);

  useEffect(() => {
    void loadTurmas();
  }, [escolaId]);

  const handleSelect = (key: string, turmaId: string) => {
    setSelectedTurmas((prev) => ({ ...prev, [key]: turmaId }));
  };

  const handleMatricular = async (grupo: GrupoMatricula) => {
    const key = grupoKey(grupo);
    const turma_id = selectedTurmas[key];
    if (!turma_id) {
      setResult((prev) => ({ ...prev, [key]: "Selecione a turma antes de matricular." }));
      return;
    }

    const payload: MatriculaMassaPayload = {
      import_id: importId,
      escola_id: escolaId,
      classe_label: grupo.classe_label,
      turma_label: grupo.turma_label,
      ano_letivo: grupo.ano_letivo,
      turma_id,
    };

    try {
      setResult((prev) => ({ ...prev, [key]: "Enviando..." }));
      const response = await fetch("/api/matriculas/massa", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Falha ao matricular");
      }

      setResult((prev) => ({
        ...prev,
        [key]: `Matriculados: ${body.success_count} • Erros: ${body.error_count}`,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao matricular";
      setResult((prev) => ({ ...prev, [key]: message }));
    }
  };

  const turmasOptions = useMemo(() => turmas, [turmas]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Matrícula em massa</h2>
          <p className="text-sm text-muted-foreground">
            Grupos detectados no staging por classe, turma e ano letivo. Selecione a turma real e confirme.
          </p>
        </div>
        <Button variant="secondary" onClick={loadGrupos} disabled={loading}>
          Recarregar grupos
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading && <p className="text-sm">Carregando grupos...</p>}

      {!loading && grupos.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum grupo elegível encontrado para este import_id.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {grupos.map((grupo) => {
          const key = grupoKey(grupo);
          const selected = selectedTurmas[key] || "";
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle>
                  {grupo.classe_label} {grupo.turma_label && `– ${grupo.turma_label}`} ({grupo.ano_letivo})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{grupo.count} alunos no grupo</p>
                <div className="space-y-1">
                  <Label>Turma de destino</Label>
                  <Select value={selected} onChange={(e) => handleSelect(key, e.target.value)}>
                    <option value="">Selecione a turma real</option>
                    {turmasOptions.map((turma) => (
                      <option key={turma.id} value={turma.id}>
                        {turma.nome}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Alunos (até 10 para conferência)</Label>
                  <ul className="text-sm list-disc list-inside text-muted-foreground">
                    {grupo.alunos.slice(0, 10).map((aluno) => (
                      <li key={aluno.id}>
                        {aluno.nome || "Sem nome"} {aluno.numero_matricula ? `(${aluno.numero_matricula})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button onClick={() => handleMatricular(grupo)} disabled={!selected || !escolaId}>
                  Matricular grupo
                </Button>
                {result[key] && <p className="text-sm text-muted-foreground">{result[key]}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
