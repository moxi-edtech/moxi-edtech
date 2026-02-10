"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SlotsConfig, type HorarioSlot } from "@/components/escola/horarios/SlotsConfig";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { enqueueOfflineAction } from "@/lib/offline/queue";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/Spinner";

type Turno = {
  id: string;
  label: string;
};

export default function HorariosSlotsPage() {
  const params = useParams();
  const escolaId = params?.id as string;
  const router = useRouter();
  const [slots, setSlots] = useState<HorarioSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const { online } = useOfflineStatus();
  const requestRef = useRef(0);

  const turnos = useMemo<Turno[]>(
    () => [
      { id: "matinal", label: "Matinal" },
      { id: "tarde", label: "Tarde" },
      { id: "noite", label: "Noite" },
    ],
    []
  );

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!escolaId) return;
    const controller = new AbortController();
    const requestId = ++requestRef.current;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/escolas/${escolaId}/horarios/slots`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        if (res.ok && json.ok) {
          setSlots(json.items || []);
        } else {
          setSlots([]);
        }
      } finally {
        if (!controller.signal.aborted && requestId === requestRef.current) {
          setLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [escolaId]);

  const handleSave = async () => {
    if (!escolaId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const request = {
        url: `/api/escolas/${escolaId}/horarios/slots`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
        type: "horarios_slots",
      };

      if (!online) {
        await enqueueOfflineAction(request);
        toast.message("Configuração enviada para sincronização.");
        return;
      }

      const res = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setSlots(json.items || []);
        toast.success("Estrutura de horários salva!", {
          description: "Agora você pode distribuir as aulas nas turmas.",
          action: {
            label: "Ir para o Quadro",
            onClick: () => router.push(`/escola/${escolaId}/horarios/quadro`),
          },
          duration: 5000,
        });
      } else {
        setSaveError(json?.error || "Falha ao salvar slots");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans">
      <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Estrutura de Horários</h1>
            <p className="text-sm text-slate-500">
              Configure os tempos e intervalos que serão usados no quadro.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
            <Link
              href={`/escola/${escolaId}/horarios/slots`}
              className="rounded-full bg-slate-950 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Slots
            </Link>
            <Link
              href={`/escola/${escolaId}/horarios/quadro`}
              className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950"
            >
              Quadro
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Spinner className="text-klasse-gold" size={24} />
              <span className="ml-3 text-sm">Carregando horários...</span>
            </div>
          ) : (
            <SlotsConfig turnos={turnos} value={slots} onChange={setSlots} onSave={handleSave} />
          )}
        </div>

        <div className="text-xs text-slate-500">
          {saving
            ? "Salvando configuração..."
            : hasMounted && !online
              ? "Offline: alterações serão sincronizadas."
              : ""}
          {saveError ? <span className="ml-2 text-rose-600">{saveError}</span> : null}
        </div>
      </div>
    </div>
  );
}
