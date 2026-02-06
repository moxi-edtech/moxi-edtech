"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { SlotsConfig, type HorarioSlot } from "@/components/escola/horarios/SlotsConfig";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { enqueueOfflineAction } from "@/lib/offline/queue";

type Turno = {
  id: string;
  label: string;
};

export default function HorariosSlotsPage() {
  const params = useParams();
  const escolaId = params?.id as string;
  const [slots, setSlots] = useState<HorarioSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { online } = useOfflineStatus();

  const turnos = useMemo<Turno[]>(
    () => [
      { id: "matinal", label: "Matinal" },
      { id: "tarde", label: "Tarde" },
      { id: "noite", label: "Noite" },
    ],
    []
  );

  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/escolas/${escolaId}/horarios/slots`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          setSlots(json.items || []);
        } else {
          setSlots([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
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
      } else {
        setSaveError(json?.error || "Falha ao salvar slots");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {loading ? (
        <div className="max-w-4xl mx-auto p-6 space-y-3">
          <div className="h-6 w-48 bg-slate-200 animate-pulse rounded" />
          <div className="h-4 w-full bg-slate-100 animate-pulse rounded" />
          <div className="h-64 w-full bg-slate-100 animate-pulse rounded-xl" />
        </div>
      ) : (
        <SlotsConfig turnos={turnos} value={slots} onChange={setSlots} onSave={handleSave} />
      )}
      <div className="max-w-4xl mx-auto px-6 pb-6 text-xs text-slate-500">
        {saving ? "Salvando configuração..." : online ? "" : "Offline: alterações serão sincronizadas."}
        {saveError ? <span className="ml-2 text-rose-600">{saveError}</span> : null}
      </div>
    </div>
  );
}
