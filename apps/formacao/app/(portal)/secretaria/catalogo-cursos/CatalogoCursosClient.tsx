"use client";

import { useEffect, useState } from "react";

type Curso = {
  id: string;
  codigo: string;
  nome: string;
  area: string | null;
  modalidade: "presencial" | "online" | "hibrido";
  carga_horaria: number | null;
  status: "ativo" | "inativo";
};

export default function CatalogoCursosClient() {
  const [items, setItems] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/formacao/backoffice/cursos", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; items?: Curso[] } | null;
        if (!res.ok || !json?.ok || !Array.isArray(json.items)) throw new Error(json?.error || "Falha ao carregar catálogo");
        setItems(json.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.7 }}>
          Secretaria Centro
        </p>
        <h1 style={{ margin: "6px 0 0" }}>Catálogo de Cursos</h1>
      </header>

      {error ? <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0 }}>Carregando...</p> : null}

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <Th>Código</Th>
              <Th>Curso</Th>
              <Th>Área</Th>
              <Th>Modalidade</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.codigo}</Td>
                <Td>{item.nome}</Td>
                <Td>{item.area || "-"}</Td>
                <Td>{item.modalidade}</Td>
                <Td>{item.status}</Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <Td colSpan={5}>Sem cursos cadastrados.</Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>{children}</td>;
}
